export const returnsJSX = (node) => {
    // 简化的JSX检测：检查函数体中是否包含JSX相关的代码模式
    const nodeStr = JSON.stringify(node)
    return nodeStr.includes('JSXElement') || 
           nodeStr.includes('JSXFragment') ||
           nodeStr.includes('JSXText')
  }