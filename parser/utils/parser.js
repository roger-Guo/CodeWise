import fs from 'fs-extra'
import path from 'path'
import { glob } from 'glob'

/**
 * 批量解析整个项目文件夹
 * @param {string} projectPath - 项目路径
 * @param {string} outputDir - 输出目录
 * @param {string} pattern - 文件匹配模式
 */
export const parseProjectFolder = async (projectPath, outputDir, pattern = '**/*.{jsx,tsx,js,ts}') => {
    try {
      console.log(`🔄 开始解析项目: ${projectPath}`)
      console.log(`📁 输出目录: ${outputDir}`)
      console.log(`🔍 文件模式: ${pattern}`)
      
      // 确保输出目录存在
      await fs.ensureDir(outputDir)
      
      // 查找所有符合条件的文件
      const files = await glob(pattern, { 
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
      })
      
      console.log(`📋 找到 ${files.length} 个文件需要解析`)
      
      const results = []
      let successCount = 0
      let errorCount = 0
      
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
            await this.saveResults(result, outputDir)
            results.push(result)
          }
        } catch (error) {
          console.log(`❌ 解析异常: ${file} - ${error.message}`)
          errorCount++
        }
      }
      
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