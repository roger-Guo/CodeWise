import * as t from '@babel/types'

/**
 * 分析函数使用的外部导入模块
 * @param {Object} node - 函数节点
 * @param {Array} imports - 所有import信息
 * @returns {Array} 该函数使用的导入模块列表
 */
export const analyzeUsedImports = (node, imports) => {
    const usedImports = []
    const importMap = new Map()
    
    // 构建导入映射：local名称 -> 导入信息
    imports.forEach(importInfo => {
      importInfo.specifiers.forEach(spec => {
        importMap.set(spec.local, {
          source: importInfo.source,
          imported: spec.imported,
          type: spec.type,
          resolvedPath: spec.resolvedPath,
          line: importInfo.line
        })
      })
    })

    // 收集函数体内使用的标识符
    const usedIdentifiers = new Set()
    
    // 递归遍历节点收集标识符
    const collectIdentifiers = (astNode) => {
      if (!astNode || typeof astNode !== 'object') return
      
      // 处理标识符节点
      if (t.isIdentifier(astNode) && astNode.name) {
        usedIdentifiers.add(astNode.name)
      }
      
      // 处理JSX标识符
      if (t.isJSXIdentifier(astNode) && astNode.name) {
        usedIdentifiers.add(astNode.name)
      }
      
      // 递归遍历所有子节点
      Object.keys(astNode).forEach(key => {
        if (key === 'loc' || key === 'start' || key === 'end') return
        
        const child = astNode[key]
        if (Array.isArray(child)) {
          child.forEach(item => collectIdentifiers(item))
        } else if (typeof child === 'object' && child !== null) {
          collectIdentifiers(child)
        }
      })
    }
    
    // 从函数体开始收集标识符
    if (node.body) {
      collectIdentifiers(node.body)
    }

    // 匹配使用的标识符与导入的模块
    usedIdentifiers.forEach(identifier => {
      if (importMap.has(identifier)) {
        const importInfo = importMap.get(identifier)
        // 检查是否已添加相同的依赖
        const existing = usedImports.find(used => 
          used.source === importInfo.source && 
          used.imported === importInfo.imported
        )
        if (!existing) {
          usedImports.push({
            source: importInfo.source,
            imported: importInfo.imported,
            local: identifier,
            type: importInfo.type,
            resolvedPath: importInfo.resolvedPath,
            importLine: importInfo.line
          })
        }
      }
    })

    return usedImports
  }