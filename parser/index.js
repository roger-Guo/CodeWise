#!/usr/bin/env node

import ReactSimpleParser from './parseReact.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 命令行参数解析
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    projectPath: process.cwd(),
    pattern: '**/*.{jsx,tsx,js,ts}',
    outputDir: null,
    summaryFile: null,
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
      case '--pattern':
        config.pattern = args[++i]
        break
      case '-o':
      case '--output':
        config.outputDir = args[++i]
        break
      case '-s':
      case '--summary':
        config.summaryFile = args[++i]
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
🔍 CodeWise React 简化解析器

用法:
  node index.js [项目路径] [选项]

选项:
  -p, --project <path>    指定React项目路径 (默认: 当前目录)
  --pattern <pattern>     文件匹配模式 (默认: **/*.{jsx,tsx,js,ts})
  -o, --output <dir>      输出目录，每个React文件生成一个JSON文件
  -s, --summary <file>    汇总结果JSON文件路径
  -h, --help             显示帮助信息

示例:
  node index.js                                    # 解析当前目录下的React文件
  node index.js ./src                              # 解析src目录下的React文件
  node index.js -o ./output                        # 解析并保存每个文件到独立JSON
  node index.js -s summary.json                    # 解析并保存汇总结果
  node index.js -o ./output -s summary.json        # 同时保存独立文件和汇总结果
  node index.js --pattern "src/**/*.{jsx,tsx}"     # 使用自定义文件匹配模式

输出格式:
  每个React文件解析为包含以下结构的JSON:
  {
    "filePath": "文件路径",
    "fileName": "文件名",
    "fileType": "javascript|typescript",
    "isJSX": true,
    "content": "完整源代码",
    "imports": [{"source": "./Component", "specifiers": [...]}],
    "exports": [{"type": "default", "name": "MyComponent"}],
    "components": [{"name": "MyComponent", "type": "function", "isComponent": true}],
    "functions": [{"name": "handleClick", "type": "arrow", "line": 10}],
    "comments": [{"content": "注释内容", "line": 3, "type": "CommentLine"}],
    "dependencies": [{"source": "./utils", "resolvedPath": "src/utils.js"}]
  }
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

  console.log('🚀 CodeWise React 简化解析器启动')
  console.log(`📁 项目路径: ${config.projectPath}`)
  console.log(`🔍 匹配模式: ${config.pattern}`)
  
  if (config.outputDir) {
    console.log(`📄 输出目录: ${config.outputDir}`)
  }
  if (config.summaryFile) {
    console.log(`📄 汇总文件: ${config.summaryFile}`)
  }
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

    // 开始解析
    console.log('🔄 开始解析React文件...')
    const startTime = Date.now()
    
    const results = await parser.parseProject(config.projectPath, config.pattern)
    
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000

    // 统计信息
    let totalComments = 0
    let totalComponents = 0
    let totalHooks = 0
    let totalFunctions = 0
    let totalDependencies = 0
    let successCount = 0
    let errorCount = 0
    let jsxFileCount = 0
    let tsFileCount = 0

    results.forEach(result => {
      if (result.error) {
        errorCount++
        return
      }
      
      successCount++
      
      // 统计注释
      totalComments += result.comments?.length || 0
      
      // 统计组件
      totalComponents += result.components?.length || 0
      
      // 统计函数
      totalFunctions += result.functions?.length || 0
      
      // 统计依赖关系
      totalDependencies += result.dependencies?.length || 0
      
      // 统计文件类型
      if (result.isJSX) {
        jsxFileCount++
      }
      if (result.fileType === 'typescript') {
        tsFileCount++
      }
    })

    // 显示结果
    console.log()
    console.log('✅ 解析完成!')
    console.log(`📊 统计信息:`)
    console.log(`   - 发现文件: ${results.length} 个`)
    console.log(`   - 成功解析: ${successCount} 个`)
    console.log(`   - 解析失败: ${errorCount} 个`)
    console.log(`   - JSX文件: ${jsxFileCount} 个`)
    console.log(`   - TypeScript文件: ${tsFileCount} 个`)
    console.log(`   - 总注释数: ${totalComments}`)
    console.log(`   - 总组件数: ${totalComponents}`)
    console.log(`   - 总Hook调用: ${totalHooks}`)
    console.log(`   - 总函数数: ${totalFunctions}`)
    console.log(`   - 总依赖关系: ${totalDependencies}`)
    console.log(`   - 解析耗时: ${duration.toFixed(2)}s`)

    // 保存结果
    if (config.outputDir) {
      console.log()
      console.log('💾 保存独立JSON文件...')
      await parser.saveResults(results, config.outputDir)
    }
    
    if (config.summaryFile) {
      console.log()
      console.log('💾 保存汇总结果...')
      await parser.saveSummaryResults(results, config.summaryFile)
    }

    // 显示错误文件
    if (errorCount > 0) {
      console.log()
      console.log('❌ 解析失败的文件:')
      results.forEach(result => {
        if (result.error) {
          console.log(`   - ${result.fileName}: ${result.error}`)
        }
      })
    }

    // 显示输出位置信息
    if (config.outputDir || config.summaryFile) {
      console.log()
      console.log('📁 输出文件位置:')
      if (config.outputDir) {
        console.log(`   - 独立JSON文件: ${path.resolve(config.outputDir)}`)
      }
      if (config.summaryFile) {
        console.log(`   - 汇总JSON文件: ${path.resolve(config.summaryFile)}`)
      }
    }

    // 如果没有指定输出，显示提示
    if (!config.outputDir && !config.summaryFile) {
      console.log()
      console.log('💡 提示: 使用 -o <目录> 保存独立JSON文件，或使用 -s <文件> 保存汇总结果')
      console.log('   示例: node index.js -o ./output')
    }

  } catch (error) {
    console.error('❌ 解析过程中发生错误:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 程序执行失败:', error)
  process.exit(1)
}) 