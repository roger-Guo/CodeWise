import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

// 处理 @babel/traverse 的 ES 模块导入
const traverseAST = traverse.default || traverse
import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'
import _ from 'lodash'
import { analyzeUsedImports } from './src/encoder/dependencies/index.js'
import { isReactComponent, isLocalImport, resolveImportPath } from './utils/index.js'

const { get } = _;
/**
 * React文件简化解析器
 * 输出包含源代码、注释和行数的JSON格式
 */
class ReactSimpleParser {
  constructor(options = {}) {
    this.options = {
      // 是否保留注释
      preserveComments: true,
      // 支持的文件扩展名
      supportedExtensions: ['.jsx', '.tsx', '.js', '.ts'],
      ...options
    }
  }

  /**
   * 解析单个React文件
   * @param {string} filePath - React文件路径
   * @param {string} content - 文件内容（可选，如果不提供则从文件读取）
   * @returns {Object} 解析结果
   */
  async parseReactFile(filePath, content = null) {
    try {
      // 读取文件内容
      if (!content) {
        content = await fs.readFile(filePath, 'utf-8')
      }

      // 确定文件类型
      const isTypeScript = filePath.endsWith('.tsx') || filePath.endsWith('.ts')
      const isJSX = filePath.includes('jsx') || filePath.includes('tsx') || 
                    content.includes('<') && content.includes('>')

      // 使用@babel/parser解析React文件
      const ast = parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'jsx',
          isTypeScript && 'typescript',
          'asyncGenerators',
          'bigInt',
          'classProperties',
          'decorators-legacy',
          'doExpressions',
          'dynamicImport',
          'exportDefaultFrom',
          'functionSent',
          'functionBind',
          'importMeta',
          'nullishCoalescingOperator',
          'numericSeparator',
          'objectRestSpread',
          'optionalCatchBinding',
          'optionalChaining',
          'throwExpressions',
          'topLevelAwait',
          'trailingFunctionCommas'
        ].filter(Boolean)
      })

      // 计算原始文件的行信息
      const lines = content.split('\n')

      const result = {
        filePath,
        chunkId: filePath,
        fileName: path.basename(filePath),
        fileType: isTypeScript ? 'typescript' : 'javascript',
        isJSX,
        content,
        totalLines: lines.length,
        imports: [],
        exports: [],
        components: [],
        functions: [],
        comments: [],
        dependencies: []
      }

      // 遍历AST提取信息
      this.extractFromAST(ast, result, lines, content)

      return result
    } catch (error) {
      console.error(`解析React文件失败: ${filePath}`, error)
      return {
        filePath,
        fileName: path.basename(filePath),
        error: error.message,
        content: content || '',
        imports: [],
        exports: [],
        components: [],
        functions: [],
        comments: [],
        dependencies: []
      }
    }
  }

  /**
   * 从AST中提取各种信息
   * @param {Object} ast - Babel AST
   * @param {Object} result - 结果对象
   * @param {Array} lines - 文件行数组
   * @param {string} content - 文件内容
   */
  extractFromAST(ast, result, lines, content = '') {
    // 作用域栈，用于跟踪当前的嵌套层级
    const scopeStack = []
    
    // 提取注释
    if (this.options.preserveComments && ast.comments) {
      result.comments = ast.comments.map(comment => ({
        type: comment.type, // 'CommentBlock' or 'CommentLine'
        content: comment.value.trim(),
        line: comment.loc.start.line,
        column: comment.loc.start.column,
        endLine: comment.loc.end.line,
        endColumn: comment.loc.end.column
      }))
    }

    // 遍历AST节点
    traverseAST(ast, {
      // 提取import语句
      ImportDeclaration: (path) => {
        const importNode = path.node
        const importInfo = {
          source: importNode.source.value,
          line: importNode.loc.start.line,
          specifiers: []
        }

        // 解析导入说明符
        importNode.specifiers.forEach(spec => {
          if (t.isImportDefaultSpecifier(spec)) {
            const resolvedPath = resolveImportPath(importInfo.source, result.filePath);
            importInfo.specifiers.push({
              type: 'default',
              imported: 'default',
              resolvedPath,
              local: spec.local.name
            })
          } else if (t.isImportSpecifier(spec)) {
            const resolvedPath = resolveImportPath(importInfo.source, result.filePath);
            importInfo.specifiers.push({
              type: 'named',
              imported: spec.imported.name,
              local: spec.local.name,
              resolvedPath,
            })
          } else if (t.isImportNamespaceSpecifier(spec)) {
            importInfo.specifiers.push({
              type: 'namespace',
              imported: '*',
              local: spec.local.name
            })
          }
        })

        result.imports.push(importInfo)

        // 添加到依赖关系
        if (isLocalImport(importInfo.source)) {
          const resolvedPath = resolveImportPath(importInfo.source, result.filePath);
          result.dependencies.push({
            source: importInfo.source,
            resolvedPath,
            imports: importInfo.specifiers
          })
        }
      },

      // 提取export语句
      ExportNamedDeclaration: (path) => {
        this.extractExport(path.node, result, 'named')
      },

      ExportDefaultDeclaration: (path) => {
        this.extractExport(path.node, result, 'default')
      },

      // 提取函数组件
      FunctionDeclaration: {
        enter: (path) => {
          const funcName = path.node.id ? path.node.id.name : 'anonymous'
          const currentScope = scopeStack.length > 0 ? scopeStack.join('.') : null
          
          this.extractFunction(path.node, result, 'function', null, content, lines, currentScope)
          
          // 将当前函数推入作用域栈
          scopeStack.push(funcName)
        },
        exit: (path) => {
          // 退出时从作用域栈弹出
          scopeStack.pop()
        }
      },

      ArrowFunctionExpression: {
        enter: (path) => {
          // 检查是否是变量声明中的箭头函数组件
          if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
            const funcName = path.parent.id.name
            const currentScope = scopeStack.length > 0 ? scopeStack.join('.') : null
            
            this.extractFunction(path.node, result, 'arrow', funcName, content, lines, currentScope)
            
            // 将当前函数推入作用域栈
            scopeStack.push(funcName)
          }
        },
        exit: (path) => {
          // 退出时从作用域栈弹出
          if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
            scopeStack.pop()
          }
        }
      },

      // 提取类（包括React组件类和普通类）
      ClassDeclaration: {
        enter: (path) => {
          const className = path.node.id.name
          const currentScope = scopeStack.length > 0 ? scopeStack.join('.') : null
          
          // 提取所有类，不仅仅是React组件
          this.extractClass(path.node, result, currentScope, content, lines)
          
          // 将当前类推入作用域栈
          scopeStack.push(className)
        },
        exit: (path) => {
          scopeStack.pop()
        }
      },
    })
  }

  /**
   * 提取export信息
   */
  extractExport(node, result, type) {
    const exportInfo = {
      type,
      line: node.loc.start.line
    }
    if (type === 'default') {
      if (t.isIdentifier(node.declaration)) {
        exportInfo.name = node.declaration.name
      } else if (t.isFunctionDeclaration(node.declaration)) {
        exportInfo.name = node.declaration.id ? node.declaration.id.name : 'anonymous'
      }
    } else if (type === 'named') {
      const name = get(node, 'declaration.declarations[0].id.name') || get(node, 'declaration.id.name')
      exportInfo.name = name;
      if (!name) {
        console.log('ExportNamedNotFound##### ', node);
      }
    }

    result.exports.push(exportInfo)
  }

  /**
   * 提取函数信息
   */
  extractFunction(node, result, funcType, name = null, content = '', lines = [], scopePath = null) {
    const functionName = name || (node.id ? node.id.name : 'anonymous')
    const fileName = result.fileName
    
    // 生成qualifiedName: [文件名]::[作用域路径].[名称]
    let qualifiedName = `${fileName}::`
    if (scopePath) {
      qualifiedName += `${scopePath}.${functionName}`
    } else {
      qualifiedName += functionName
    }
    
    const functionInfo = {
      type: funcType,
      name: functionName,
      startLine: node.loc.start.line,
      endLine: node.loc.end.line,
      params: [],
      isComponent: false,
      scopePath, // 作用域路径，顶层为null
      isTopLevel: scopePath === null, // 是否为顶层函数
      qualifiedName, // 全局唯一限定名
      usedImports: [], // 该函数使用的外部导入模块
      isAsync: node.async || false,
      isExported: false,
      exportType: null,
      calls: [] // 函数调用信息
    }

    // 提取函数的源代码文本
    if (content && lines.length > 0) {
      const startLine = node.loc.start.line - 1 // 转换为0索引
      const endLine = node.loc.end.line - 1
      
      if (startLine >= 0 && endLine < lines.length) {
        const functionLines = lines.slice(startLine, endLine + 1)
        functionInfo.codeBlock = functionLines.join('\n')
      }
    }

    // 提取与函数相关的注释
    functionInfo.associatedComments = this.extractFunctionComments(node, result.comments)

    // 分析函数使用的外部导入
    functionInfo.usedImports = analyzeUsedImports(node, result.imports)

    // 提取参数
    if (node.params) {
      functionInfo.params = node.params.map(param => {
        if (t.isIdentifier(param)) {
          return { name: param.name, type: 'simple' }
        } else if (t.isObjectPattern(param)) {
          return { name: 'destructured', type: 'object' }
        } else if (t.isArrayPattern(param)) {
          return { name: 'destructured', type: 'array' }
        }
        return { name: 'unknown', type: 'complex' }
      })
    }

    result.functions.push(functionInfo)
  }

  /**
   * 提取与函数相关的注释
   * @param {Object} node - 函数节点
   * @param {Array} allComments - 所有注释列表
   * @returns {Array} 与函数相关的注释
   */
  extractFunctionComments(node, allComments) {
    const functionComments = []
    const functionStartLine = node.loc.start.line
    const functionEndLine = node.loc.end.line

    if (!allComments || allComments.length === 0) {
      return functionComments
    }

    allComments.forEach(comment => {
      // 检查注释是否在函数内部
      if (comment.line >= functionStartLine && comment.line <= functionEndLine) {
        functionComments.push({
          type: comment.type,
          content: comment.content,
          line: comment.line,
          position: 'inside'
        })
      }
      // 检查注释是否在函数前面（可能是函数的文档注释）
      else if (comment.endLine && comment.endLine === functionStartLine - 1) {
        functionComments.push({
          type: comment.type,
          content: comment.content,
          line: comment.line,
          position: 'leading'
        })
      }
      // 检查注释是否在函数前面几行内（可能是相关的注释）
      else if (comment.line >= functionStartLine - 3 && comment.line < functionStartLine) {
        functionComments.push({
          type: comment.type,
          content: comment.content,
          line: comment.line,
          position: 'leading'
        })
      }
    })

    return functionComments
  }

  /**
   * 提取类信息（包括React组件类和普通类）
   */
  extractClass(node, result, scopePath = null, content = '', lines = []) {
    const className = node.id.name
    const fileName = result.fileName
    
    // 判断是否是React组件
    const isReactComp = isReactComponent(node)
    
    // 生成qualifiedName: [文件名]::[作用域路径].[名称]
    let qualifiedName = `${fileName}::`
    if (scopePath) {
      qualifiedName += `${scopePath}.${className}`
    } else {
      qualifiedName += className
    }
    
    const classInfo = {
      type: 'class',
      name: className,
      startLine: node.loc.start.line,
      endLine: node.loc.end.line,
      isComponent: isReactComp, // 区分是否是React组件
      isReactComponent: isReactComp, // 明确标识React组件
      componentType: isReactComp ? 'class' : null, // React组件类型
      methods: [],
      properties: [], // 添加属性字段
      superClass: null, // 父类信息
      scopePath, // 作用域路径，顶层为null
      isTopLevel: scopePath === null, // 是否为顶层类
      qualifiedName, // 全局唯一限定名
      jsx: [],
      isExported: false,
      exportType: null,
      codeBlock: '' // 需要在后面填充
    }

    // 提取类的源代码文本
    if (content && lines.length > 0) {
      const startLine = node.loc.start.line - 1 // 转换为0索引
      const endLine = node.loc.end.line - 1
      
      if (startLine >= 0 && endLine < lines.length) {
        const classLines = lines.slice(startLine, endLine + 1)
        classInfo.codeBlock = classLines.join('\n')
      }
    }

    // 提取父类信息
    if (node.superClass) {
      if (t.isIdentifier(node.superClass)) {
        classInfo.superClass = node.superClass.name
      } else if (t.isMemberExpression(node.superClass)) {
        // 处理 React.Component 这种情况
        const object = node.superClass.object.name
        const property = node.superClass.property.name
        classInfo.superClass = `${object}.${property}`
      }
    }

    // 提取类方法和属性
    if (node.body && node.body.body) {
      node.body.body.forEach(member => {
        if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
          classInfo.methods.push({
            name: member.key.name,
            type: member.kind, // 'method', 'constructor', 'get', 'set'
            line: member.loc.start.line,
            isStatic: member.static || false,
            isAsync: member.async || false
          })
        } else if (t.isClassProperty(member) && t.isIdentifier(member.key)) {
          // 提取类属性
          classInfo.properties.push({
            name: member.key.name,
            line: member.loc.start.line,
            isStatic: member.static || false,
            hasValue: member.value !== null
          })
        }
      })
    }

    result.components.push(classInfo)
  }

  /**
   * 提取类组件信息（保留向后兼容）
   */
  extractClassComponent(node, result, scopePath = null, content = '', lines = []) {
    // 重定向到新的extractClass方法
    this.extractClass(node, result, scopePath, content, lines)
  }

  /**
   * 批量解析React项目
   * @param {string} projectPath - 项目路径
   * @param {string} pattern - 文件匹配模式
   * @returns {Array} 解析结果数组
   */
  async parseProject(projectPath, pattern = '**/*.{jsx,tsx,js,ts}') {
    try {
      const reactFiles = await glob(pattern, { 
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
      })
      const results = []

      for (const file of reactFiles) {
        const fullPath = path.join(projectPath, file)
        console.log(`正在解析: ${file}`)
        
        const result = await this.parseReactFile(fullPath)
        results.push(result)
      }

      return results
    } catch (error) {
      console.error('批量解析项目失败:', error)
      return []
    }
  }

  /**
   * 批量解析整个项目文件夹
   * @param {string} projectPath - 项目路径
   * @param {string} outputDir - 输出目录
   * @param {string} pattern - 文件匹配模式
   */
  async parseProjectFolder(projectPath, outputDir, pattern = '**/*.{jsx,tsx,js,ts}') {
    try {
      console.log(`🔄 开始解析项目: ${projectPath}`)
      console.log(`📁 输出目录: ${outputDir}`)
      console.log(`🔍 文件模式: ${pattern}`)
      
      // 确保输出目录存在
      await fs.ensureDir(outputDir)
      
      // 查找所有符合条件的文件
      const files = await glob(pattern, { 
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/styles.ts']
      })
      
      console.log(`📋 找到 ${files.length} 个文件需要解析`)
      
      const results = []
      let successCount = 0
      let errorCount = 0
      const saveResultsParams = [];
      
      // 逐个解析文件
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fullPath = path.join(projectPath, file)
        
        console.log(`[${i + 1}/${files.length}] 解析: ${file}`)
        
        try {
          const result = await this.parseReactFile(fullPath)
          
          if (result.error) {
            console.log(`❌ 解析失败: ${file} - ${result.error}`)
            errorCount++
          } else {
            console.log(`✅ 解析成功: ${file}`)
            successCount++
            
            // 保存分离式输出
            // await this.saveResults(result, outputDir, projectPath);
            saveResultsParams.push([result, outputDir, projectPath]);
            results.push(result)
          }
        } catch (error) {
          console.log(`❌ 解析异常: ${file} - ${error.message}`)
          errorCount++
        }
      }
      // 批量保存解析结果
      await Promise.all(saveResultsParams.map(params => this.saveResults(...params)));
      
      // 生成项目汇总信息
      const summary = {
        projectPath,
        totalFiles: files.length,
        successCount,
        errorCount,
        fileTypes: {
          jsx: 0,
          tsx: 0,
          js: 0,
          ts: 0
        },
        statistics: {
          totalComponents: 0,
          totalFunctions: 0,
          totalClasses: 0,
          totalVariables: 0,
          totalImports: 0,
          totalExports: 0
        },
        files: results.map(result => ({
          fileName: result.fileName,
          filePath: result.filePath,
          fileType: result.fileType,
          isJSX: result.isJSX,
          components: result.components.length,
          functions: result.functions.length,
          imports: result.imports.length,
          exports: result.exports.length
        }))
      }
      
      // 统计文件类型
      results.forEach(result => {
        if (result.fileName.endsWith('.jsx')) summary.fileTypes.jsx++
        else if (result.fileName.endsWith('.tsx')) summary.fileTypes.tsx++
        else if (result.fileName.endsWith('.js')) summary.fileTypes.js++
        else if (result.fileName.endsWith('.ts')) summary.fileTypes.ts++
      })
      
      // 统计总数
      results.forEach(result => {
        summary.statistics.totalComponents += result.components.length
        summary.statistics.totalFunctions += result.functions.length
        summary.statistics.totalImports += result.imports.length
        summary.statistics.totalExports += result.exports.length
      })
      
      // 保存项目汇总信息
      const summaryPath = path.join(outputDir, 'project-summary.json')
      await fs.writeJSON(summaryPath, summary, { spaces: 2 })
      
      console.log('\n📊 项目解析完成!')
      console.log(`✅ 成功解析: ${successCount} 个文件`)
      console.log(`❌ 解析失败: ${errorCount} 个文件`)
      console.log(`📁 输出目录: ${outputDir}`)
      console.log(`📄 汇总文件: ${summaryPath}`)
      
      return {
        summary,
        results
      }
      
    } catch (error) {
      console.error('❌ 项目解析失败:', error.message)
      throw error
    }
  }

  /**
   * 保存解析结果 - 分离式输出
   * @param {Object} result - 解析结果
   * @param {string} outputDir - 输出目录
   * @param {string} projectPath - 项目根路径（可选）
   */
  async saveResults(result, outputDir, projectPath = null) {
    try {
      await fs.ensureDir(outputDir)
      console.log('outputDir', outputDir)
      
      // 计算相对路径，保持原始文件结构
      let relativePath = result.filePath
      if (projectPath) {
        relativePath = path.relative(projectPath, result.filePath)
      }
      
      // 获取文件名（不含扩展名）和目录路径
      const fileName = path.basename(result.filePath, path.extname(result.filePath))
      const dirPath = path.dirname(relativePath)
      
      // 创建保持原始路径结构的输出目录
      const fileOutputDir = path.join(outputDir, dirPath, fileName)
      await fs.ensureDir(fileOutputDir)
      
      // 创建文件目录
      const outputFileName = path.join(fileOutputDir, fileName + '.json')
      await fs.ensureFile(outputFileName)
      await fs.writeJSON(outputFileName, result, { spaces: 2 })
      
      // 创建两级目录结构
      const topLevelDir = path.join(fileOutputDir, 'top-level')
      const nestedDir = path.join(fileOutputDir, 'nested')
      await fs.ensureDir(topLevelDir)
      await fs.ensureDir(nestedDir)
      
      // 分别处理顶层和嵌套定义
      await this.saveTopLevelDefinitions(result, topLevelDir)
      await this.saveNestedDefinitions(result, nestedDir)
      
      console.log(`文件 ${result.fileName} 的解析结果已保存到: ${fileOutputDir}`)
    } catch (error) {
      console.error('保存结果失败:', error)
    }
  }

  /**
   * 保存顶层定义
   * @param {Object} result - 解析结果
   * @param {string} outputDir - 输出目录
   */
  async saveTopLevelDefinitions(result, outputDir) {
    // 保存顶层组件
    for (const component of result.components) {
      if (component.isTopLevel) {
        const type = component.type === 'class' ? 'class' : 'component';
        const componentData = this.createDefinitionJson(result, component, type)
        await fs.writeJSON(
          path.join(outputDir, `${component.name}_${type}.json`),
          componentData,
          { spaces: 2 }
        )
      }
    }

    // 保存顶层函数
    for (const func of result.functions) {
      if (func.isTopLevel) {
        const functionData = this.createDefinitionJson(result, func, 'function')
        await fs.writeJSON(
          path.join(outputDir, `${func.name}_function.json`),
          functionData,
          { spaces: 2 }
        )
      }
    }

    // 保存顶层导出变量
    for (const exp of result.exports) {
      if (exp.type === 'variable' && exp.isTopLevel) {
        const variableData = this.createDefinitionJson(result, exp, 'variable')
        await fs.writeJSON(
          path.join(outputDir, `${exp.name}_variable.json`),
          variableData,
          { spaces: 2 }
        )
      }
    }
  }

  /**
   * 保存嵌套定义
   * @param {Object} result - 解析结果
   * @param {string} outputDir - 输出目录
   */
  async saveNestedDefinitions(result, outputDir) {
    // 保存嵌套组件和类
    for (const component of result.components) {
      if (!component.isTopLevel) {
        // 根据实际类型确定保存类型和文件名
        let saveType, fileName
        if (component.type === 'class') {
          saveType = 'class'
          fileName = `${component.scopePath}_${component.name}_class.json`
        } else {
          saveType = 'component'
          fileName = `${component.scopePath}_${component.name}_component.json`
        }
        
        const componentData = this.createDefinitionJson(result, component, saveType)
        await fs.writeJSON(
          path.join(outputDir, fileName),
          componentData,
          { spaces: 2 }
        )
      }
    }

    // 保存嵌套函数
    for (const func of result.functions) {
      if (!func.isTopLevel) {
        const functionData = this.createDefinitionJson(result, func, 'function')
        await fs.writeJSON(
          path.join(outputDir, `${func.scopePath}_${func.name}_function.json`),
          functionData,
          { spaces: 2 }
        )
      }
    }

    // 保存嵌套变量
    for (const exp of result.exports) {
      if (exp.type === 'variable' && !exp.isTopLevel) {
        const variableData = this.createDefinitionJson(result, exp, 'variable')
        await fs.writeJSON(
          path.join(outputDir, `${exp.scopePath}_${exp.name}_variable.json`),
          variableData,
          { spaces: 2 }
        )
      }
    }
  }

  /**
   * 创建单个定义的JSON数据
   * @param {Object} result - 完整的解析结果
   * @param {Object} definition - 单个定义对象
   * @param {string} type - 定义类型
   * @returns {Object} 格式化的JSON数据
   */
  createDefinitionJson(result, definition, type) {
    const qualifiedName = `${result.fileName}::${definition.scopePath ? definition.scopePath + '.' : ''}${definition.name}`;
    const baseData = {
      // 文件元数据
      fileMetadata: {
        chunkId: `${result.filePath}::${qualifiedName.split('::')[1]}`,
        filePath: result.filePath,
        fileName: result.fileName,
        fileType: result.fileType,
        isJSX: result.isJSX,
        totalLines: result.totalLines,
        repositoryName: "CodeWise", // 可以从git信息获取
        version: "current", // 可以从git信息获取
        branch: "main" // 可以从git信息获取
      },

      // 定义信息
      definitionInfo: {
        // 注释信息
        comments: definition.associatedComments || [],
        name: definition.name,
        qualifiedName,
        definitionType: type,
        scopePath: definition.scopePath,
        isTopLevel: definition.isTopLevel || false,
        startLine: definition.startLine,
        endLine: definition.endLine,
        codeBlock: definition.codeBlock || '',
        description: definition.description || null,
        exportInfo: {
          isExported: definition.isExported || false,
          type: definition.exportType || null
        }
      },

      // 依赖信息
      dependencyInfo: {
        forwardReferences: this.getForwardReferences(definition),
        backwardReferences: [], // 需要全局分析才能获得
        usedImports: definition.usedImports || []
      }
    }

    return baseData
  }

  /**
   * 获取前向引用（该定义依赖的其他模块）
   */
  getForwardReferences(definition) {
    const references = []
    
    // 从imports中查找该定义使用的导入 只处理本地导入
    if (definition.usedImports) {
      definition.usedImports.filter(imp => isLocalImport(imp.source)).forEach(imp => {
        references.push({
          type: 'import',
          source: imp.source,
          imported: imp.imported,
          local: imp.local,
          resolvedPath: imp.resolvedPath + '::' + imp.local,
          line: imp.importLine
        })
      })
    }

    // 如果是组件，添加JSX元素引用
    if (definition.type === 'component' && definition.jsx) {
      definition.jsx.forEach(element => {
        if (element.type === 'component') {
          references.push({
            type: 'jsx_element',
            component: element.name,
            source: 'local', // 需要进一步分析来确定是否是导入的
            line: element.line
          })
        }
      })
    }

    return references
  }

  /**
   * 保存汇总结果到单个JSON文件
   * @param {Array} results - 解析结果数组  
   * @param {string} outputPath - 输出文件路径
   */
  async saveSummaryResults(results, outputPath) {
    try {
      await fs.ensureDir(path.dirname(outputPath))
      await fs.writeJSON(outputPath, results, { spaces: 2 })
      console.log(`汇总解析结果已保存到: ${outputPath}`)
    } catch (error) {
      console.error('保存汇总结果失败:', error)
    }
  }
}

export default ReactSimpleParser 