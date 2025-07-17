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
import { isReactComponent, returnsJSX, isLocalImport, resolveImportPath } from './utils/index.js'

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
            importInfo.specifiers.push({
              type: 'default',
              imported: 'default',
              local: spec.local.name
            })
          } else if (t.isImportSpecifier(spec)) {
            importInfo.specifiers.push({
              type: 'named',
              imported: spec.imported.name,
              local: spec.local.name
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
          result.dependencies.push({
            source: importInfo.source,
            resolvedPath: resolveImportPath(importInfo.source, result.filePath),
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

      // 提取类组件
      ClassDeclaration: {
        enter: (path) => {
          if (isReactComponent(path.node)) {
            const className = path.node.id.name
            const currentScope = scopeStack.length > 0 ? scopeStack.join('.') : null
            
            this.extractClassComponent(path.node, result, currentScope)
            
            // 将当前类推入作用域栈
            scopeStack.push(className)
          }
        },
        exit: (path) => {
          if (isReactComponent(path.node)) {
            scopeStack.pop()
          }
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
      const name = get(node, 'declaration.declarations[0].id.name')
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

    // 判断是否是React组件（首字母大写且返回JSX）
    if (functionInfo.name[0] === functionInfo.name[0].toUpperCase()) {
      functionInfo.isComponent = returnsJSX(node)
      if (functionInfo.isComponent) {
        result.components.push(functionInfo)
      }
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
   * 提取类组件信息
   */
  extractClassComponent(node, result, scopePath = null) {
    const className = node.id.name
    const fileName = result.fileName
    
    // 生成qualifiedName: [文件名]::[作用域路径].[名称]
    let qualifiedName = `${fileName}::`
    if (scopePath) {
      qualifiedName += `${scopePath}.${className}`
    } else {
      qualifiedName += className
    }
    
    const componentInfo = {
      type: 'class',
      name: className,
      startLine: node.loc.start.line,
      endLine: node.loc.end.line,
      isComponent: true,
      methods: [],
      scopePath, // 作用域路径，顶层为null
      isTopLevel: scopePath === null, // 是否为顶层类
      qualifiedName, // 全局唯一限定名
      jsx: [],
      isExported: false,
      exportType: null,
      codeBlock: '' // 需要在后面填充
    }

    // 提取类方法
    if (node.body && node.body.body) {
      node.body.body.forEach(method => {
        if (t.isClassMethod(method) && t.isIdentifier(method.key)) {
          componentInfo.methods.push({
            name: method.key.name,
            type: method.kind, // 'method', 'constructor', 'get', 'set'
            line: method.loc.start.line
          })
        }
      })
    }

    result.components.push(componentInfo)
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
   * 保存解析结果 - 分离式输出
   * @param {Object} result - 解析结果
   * @param {string} outputDir - 输出目录
   */
  async saveResults(result, outputDir) {
    try {
      await fs.ensureDir(outputDir)
      console.log('outputDir', outputDir)
      
      // 为文件创建基础目录
      const fileName = path.basename(result.filePath, path.extname(result.filePath))
      const fileOutputDir = path.join(outputDir, fileName)
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
        const componentData = this.createDefinitionJson(result, component, 'component')
        await fs.writeJSON(
          path.join(outputDir, `${component.name}_component.json`),
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

    // 保存顶层类
    const topLevelClasses = result.components.filter(comp => comp.type === 'class' && comp.isTopLevel)
    for (const cls of topLevelClasses) {
      const classData = this.createDefinitionJson(result, cls, 'class')
      await fs.writeJSON(
        path.join(outputDir, `${cls.name}_class.json`),
        classData,
        { spaces: 2 }
      )
    }
  }

  /**
   * 保存嵌套定义
   * @param {Object} result - 解析结果
   * @param {string} outputDir - 输出目录
   */
  async saveNestedDefinitions(result, outputDir) {
    // 保存嵌套组件
    for (const component of result.components) {
      if (!component.isTopLevel) {
        const componentData = this.createDefinitionJson(result, component, 'component')
        await fs.writeJSON(
          path.join(outputDir, `${component.scopePath}_${component.name}_component.json`),
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
    const baseData = {
      // 文件元数据
      fileMetadata: {
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
        qualifiedName: `${result.fileName}::${definition.scopePath ? definition.scopePath + '.' : ''}${definition.name}`,
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
    
    // 从imports中查找该定义使用的导入
    if (definition.usedImports) {
      definition.usedImports.forEach(imp => {
        references.push({
          type: 'import',
          source: imp.source,
          imported: imp.imported,
          resolvedPath: imp.resolvedPath || imp.source,
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