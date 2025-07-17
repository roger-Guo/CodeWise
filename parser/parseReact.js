import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

// 处理 @babel/traverse 的 ES 模块导入
const traverseAST = traverse.default || traverse
import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'

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
        hooks: [],
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
        hooks: [],
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
        if (this.isLocalImport(importInfo.source)) {
          result.dependencies.push({
            source: importInfo.source,
            resolvedPath: this.resolveImportPath(importInfo.source, result.filePath),
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
      FunctionDeclaration: (path) => {
        this.extractFunction(path.node, result, 'function', null, content, lines)
      },

      ArrowFunctionExpression: (path) => {
        // 检查是否是变量声明中的箭头函数组件
        if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
          this.extractFunction(path.node, result, 'arrow', path.parent.id.name, content, lines)
        }
      },

      // 提取类组件
      ClassDeclaration: (path) => {
        if (this.isReactComponent(path.node)) {
          this.extractClassComponent(path.node, result)
        }
      },

      // 提取Hook调用
      CallExpression: (path) => {
        this.extractHookUsage(path.node, result)
      }
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
      exportInfo.specifiers = []
      if (node.specifiers) {
        node.specifiers.forEach(spec => {
          exportInfo.specifiers.push({
            local: spec.local.name,
            exported: spec.exported.name
          })
        })
      }
    }

    result.exports.push(exportInfo)
  }

  /**
   * 提取函数信息
   */
  extractFunction(node, result, funcType, name = null, content = '', lines = []) {
    const functionInfo = {
      type: funcType,
      name: name || (node.id ? node.id.name : 'anonymous'),
      line: node.loc.start.line,
      endLine: node.loc.end.line,
      params: [],
      isComponent: false
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
      functionInfo.isComponent = this.returnsJSX(node)
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
  extractClassComponent(node, result) {
    const componentInfo = {
      type: 'class',
      name: node.id.name,
      line: node.loc.start.line,
      endLine: node.loc.end.line,
      isComponent: true,
      methods: []
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
   * 提取Hook使用信息
   */
  extractHookUsage(node, result) {
    if (t.isIdentifier(node.callee) && node.callee.name.startsWith('use')) {
      const hookInfo = {
        name: node.callee.name,
        line: node.loc.start.line,
        args: node.arguments.length
      }
      result.hooks.push(hookInfo)
    }
  }

  /**
   * 判断是否是React组件类
   */
  isReactComponent(node) {
    if (!node.superClass) return false
    
    if (t.isIdentifier(node.superClass)) {
      return node.superClass.name === 'Component' || node.superClass.name === 'PureComponent'
    }
    
    if (t.isMemberExpression(node.superClass)) {
      return t.isIdentifier(node.superClass.object) && 
             node.superClass.object.name === 'React' &&
             t.isIdentifier(node.superClass.property) &&
             (node.superClass.property.name === 'Component' || 
              node.superClass.property.name === 'PureComponent')
    }
    
    return false
  }

  /**
   * 判断函数是否返回JSX (简化版本)
   */
  returnsJSX(node) {
    // 简化的JSX检测：检查函数体中是否包含JSX相关的代码模式
    const nodeStr = JSON.stringify(node)
    return nodeStr.includes('JSXElement') || 
           nodeStr.includes('JSXFragment') ||
           nodeStr.includes('JSXText')
  }

  /**
   * 判断是否是本地导入（相对路径）
   */
  isLocalImport(source) {
    return source.startsWith('./') || source.startsWith('../') || source.startsWith('@/')
  }

  /**
   * 解析导入路径
   */
  resolveImportPath(source, currentFilePath) {
    if (source.startsWith('./') || source.startsWith('../')) {
      return path.resolve(path.dirname(currentFilePath), source)
    } else if (source.startsWith('@/')) {
      // 处理别名路径，这里假设@指向项目根目录的src
      return source.replace('@/', 'src/')
    }
    return source
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
   * 保存单个文件的解析结果
   * @param {Object} result - 单个文件的解析结果
   * @param {string} outputDir - 输出目录
   */
  async saveSingleResult(result, outputDir) {
    try {
      await fs.ensureDir(outputDir)
      const ext = path.extname(result.fileName)
      const baseName = path.basename(result.fileName, ext)
      const outputFileName = `${baseName}.json`
      const outputPath = path.join(outputDir, outputFileName)
      await fs.writeJSON(outputPath, result, { spaces: 2 })
      console.log(`解析结果已保存到: ${outputPath}`)
    } catch (error) {
      console.error('保存单个结果失败:', error)
    }
  }

  /**
   * 保存所有解析结果，每个文件一个JSON
   * @param {Array} results - 解析结果数组
   * @param {string} outputDir - 输出目录
   */
  async saveResults(results, outputDir) {
    try {
      await fs.ensureDir(outputDir)
      
      for (const result of results) {
        const ext = path.extname(result.fileName)
        const baseName = path.basename(result.fileName, ext)
        const outputFileName = `${baseName}.json`
        const outputPath = path.join(outputDir, outputFileName)
        await fs.writeJSON(outputPath, result, { spaces: 2 })
      }
      
      console.log(`所有解析结果已保存到目录: ${outputDir}`)
      console.log(`共保存 ${results.length} 个JSON文件`)
    } catch (error) {
      console.error('保存结果失败:', error)
    }
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