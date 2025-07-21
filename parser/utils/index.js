import * as t from '@babel/types'
import path from 'path'
import fs from 'fs-extra'

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
 * source: 导入的相对路径
 * currentFilePath: 当前文件绝对路径
 * @returns {string|null} 解析后的绝对路径，如果文件不存在返回null
 */
export const resolveImportPath1 = (source, currentFilePath) => {
    // 如果不是本地导入（相对路径或别名路径），直接返回原始路径
    if (!isLocalImport(source)) {
        return source
    }
    
    let resolvedPath
    
    // 处理相对路径
    if (source.startsWith('./') || source.startsWith('../')) {
        resolvedPath = path.resolve(path.dirname(currentFilePath), source)
    } 
    // 处理别名路径 @/ 
    else if (source.startsWith('@/')) {
        // 假设@指向项目根目录，需要找到项目根目录
        const projectRoot = findProjectRoot(currentFilePath)
        resolvedPath = path.resolve(projectRoot, source.replace('@/', 'src/'))
    }
    else {
        return source
    }
    
    // 支持的文件扩展名，按优先级排序
    const extensions = ['.ts', '.tsx', '.js', '.jsx']
    
    // 如果已经有扩展名，直接检查文件是否存在
    if (path.extname(resolvedPath)) {
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath
        }
        return null
    }
    
    // 没有扩展名，尝试添加不同的扩展名
    for (const ext of extensions) {
        const fullPath = resolvedPath + ext
        if (fs.existsSync(fullPath)) {
            return fullPath
        }
    }
    
    // 检查是否是目录，如果是目录，尝试查找index文件
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        for (const ext of extensions) {
            const indexPath = path.join(resolvedPath, 'index' + ext)
            if (fs.existsSync(indexPath)) {
                return indexPath
            }
        }
    }
    
    // 文件不存在
    return null
}

/**
 * 查找项目根目录
 * 通过向上查找package.json文件来确定项目根目录
 */
const findProjectRoot = (currentPath) => {
    let dir = path.dirname(currentPath)
    
    while (dir !== path.dirname(dir)) { // 直到到达文件系统根目录
        const packageJsonPath = path.join(dir, 'package.json')
        if (fs.existsSync(packageJsonPath)) {
            return dir
        }
        dir = path.dirname(dir)
    }
    
    // 如果没找到package.json，返回当前文件所在目录
    return path.dirname(currentPath)
}

const getFileNameInProject = (filePath, projectName) => {
    // 如果filePath为null或undefined，直接返回
    if (!filePath) {
        return filePath
    }
    
    if (filePath.indexOf(projectName) === 0) {
        return filePath
    } else if (filePath.includes(projectName)) {
        return projectName + filePath.split(projectName)[1]
    }
    return filePath;
}

/**
 * 解析导入路径 
 */
export const resolveImportPath = (source, currentFilePath, projectName = 'ant-design-pro') => {
    const path = resolveImportPath1(source, currentFilePath)
    return getFileNameInProject(path, projectName)
}