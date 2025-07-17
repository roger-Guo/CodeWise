import * as t from '@babel/types'
import path from 'path'

export const returnsJSX = (node) => {
    // 简化的JSX检测：检查函数体中是否包含JSX相关的代码模式
    const nodeStr = JSON.stringify(node)
    return nodeStr.includes('JSXElement') ||
        nodeStr.includes('JSXFragment') ||
        nodeStr.includes('JSXText')
}

/**
 * 判断是否是React组件类
 */
export const isReactComponent = (node) => {
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
* 判断是否是本地导入（相对路径）
*/
export const isLocalImport = (source) => {
    return source.startsWith('./') || source.startsWith('../') || source.startsWith('@/')
}

/**
 * 解析导入路径
 */
export const resolveImportPath = (source, currentFilePath) => {
    if (source.startsWith('./') || source.startsWith('../')) {
        return path.resolve(path.dirname(currentFilePath), source)
    } else if (source.startsWith('@/')) {
        // 处理别名路径，这里假设@指向项目根目录的src
        return source.replace('@/', 'src/')
    }
    return source
}
