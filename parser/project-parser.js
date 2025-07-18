#!/usr/bin/env node

import ReactSimpleParser from './parseReact.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)

/**
 * 命令行参数解析
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    projectPath: './test-files',
    outputDir: './output',
    pattern: '**/*.{jsx,tsx,js,ts}',
    help: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '-h':
      case '--help':
        config.help = true
        break
      case '-p':
      case '--project':
        config.projectPath = args[++i]
        break
      case '-o':
      case '--output':
        config.outputDir = args[++i]
        break
      case '--pattern':
        config.pattern = args[++i]
        break
      default:
        if (!arg.startsWith('-')) {
          config.projectPath = arg
        }
        break
    }
  }

  return config
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
🔍 CodeWise 项目批量解析器

用法:
  node project-parser.js [项目路径] [选项]

选项:
  -p, --project <path>    指定项目路径 (默认: ./test-files)
  -o, --output <dir>      输出目录 (默认: ./output)
  --pattern <pattern>     文件匹配模式 (默认: **/*.{jsx,tsx,js,ts})
  -h, --help             显示帮助信息

示例:
  node project-parser.js                                    # 解析默认项目
  node project-parser.js ./src                              # 解析src目录
  node project-parser.js -o ./results                       # 指定输出目录
  node project-parser.js --pattern "src/**/*.{jsx,tsx}"     # 自定义文件模式

输出结构:
  output/
  ├── project-summary.json          # 项目汇总信息
  ├── [文件名1]/
  │   ├── [文件名1].json           # 完整文件信息
  │   ├── top-level/               # 顶层定义
  │   │   ├── [名称]_component.json
  │   │   ├── [名称]_function.json
  │   │   └── [名称]_variable.json
  │   └── nested/                  # 嵌套定义
  │       ├── [作用域]_[名称]_function.json
  │       └── [作用域]_[名称]_component.json
  └── [文件名2]/
      ├── [文件名2].json
      ├── top-level/
      └── nested/
`)
}

/**
 * 主函数
 */
async function main() {
  const config = parseArgs()

  if (config.help) {
    showHelp()
    process.exit(0)
  }

  console.log('🚀 CodeWise 项目批量解析器启动')
  console.log(`📁 项目路径: ${config.projectPath}`)
  console.log(`📁 输出目录: ${config.outputDir}`)
  console.log(`🔍 文件模式: ${config.pattern}`)
  console.log()

  try {
    // 检查项目路径是否存在
    const fs = await import('fs-extra')
    if (!await fs.pathExists(config.projectPath)) {
      console.error(`❌ 项目路径不存在: ${config.projectPath}`)
      process.exit(1)
    }

    // 创建解析器实例
    const parser = new ReactSimpleParser({
      preserveComments: true
    })

    // 开始批量解析
    const result = await parser.parseProjectFolder(
      config.projectPath, 
      config.outputDir, 
      config.pattern
    )

    console.log('\n🎉 项目解析完成!')
    console.log(`📊 最终统计:`)
    console.log(`   - 总文件数: ${result.summary.totalFiles}`)
    console.log(`   - 成功解析: ${result.summary.successCount}`)
    console.log(`   - 解析失败: ${result.summary.errorCount}`)
    console.log(`   - JSX文件: ${result.summary.fileTypes.jsx}`)
    console.log(`   - TSX文件: ${result.summary.fileTypes.tsx}`)
    console.log(`   - JS文件: ${result.summary.fileTypes.js}`)
    console.log(`   - TS文件: ${result.summary.fileTypes.ts}`)
    console.log(`   - 总组件数: ${result.summary.statistics.totalComponents}`)
    console.log(`   - 总函数数: ${result.summary.statistics.totalFunctions}`)
    console.log(`   - 总导入数: ${result.summary.statistics.totalImports}`)
    console.log(`   - 总导出数: ${result.summary.statistics.totalExports}`)
    
    console.log(`\n📁 输出目录: ${path.resolve(config.outputDir)}`)
    console.log(`📄 汇总文件: ${path.resolve(config.outputDir)}/project-summary.json`)

  } catch (error) {
    console.error('❌ 项目解析失败:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 程序执行失败:', error)
  process.exit(1)
}) 