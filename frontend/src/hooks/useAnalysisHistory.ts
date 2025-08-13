import { useState, useEffect } from 'react'
import { AnalysisResponse } from '@/services/api'

export interface AnalysisHistoryItem {
  id: string
  query: string
  result: AnalysisResponse
  timestamp: number
  analysis_type: string
}

const STORAGE_KEY = 'codewise_analysis_history'
const MAX_HISTORY_ITEMS = 100

export const useAnalysisHistory = () => {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([])

  // 从本地存储加载历史记录
  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY)
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setHistory(Array.isArray(parsed) ? parsed : [])
      } catch (error) {
        console.error('解析历史记录失败:', error)
        setHistory([])
      }
    }
  }, [])

  // 保存历史记录到本地存储
  const saveToStorage = (newHistory: AnalysisHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
    } catch (error) {
      console.error('保存历史记录失败:', error)
    }
  }

  // 添加新的分析记录
  const addAnalysis = (params: Omit<AnalysisHistoryItem, 'id'>) => {
    const newItem: AnalysisHistoryItem = {
      ...params,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    setHistory(prevHistory => {
      // 添加到开头，保持最新的在前面
      const newHistory = [newItem, ...prevHistory]
      
      // 限制历史记录数量
      const trimmedHistory = newHistory.slice(0, MAX_HISTORY_ITEMS)
      
      // 保存到本地存储
      saveToStorage(trimmedHistory)
      
      return trimmedHistory
    })

    return newItem.id
  }

  // 删除指定的历史记录
  const removeAnalysis = (id: string) => {
    setHistory(prevHistory => {
      const newHistory = prevHistory.filter(item => item.id !== id)
      saveToStorage(newHistory)
      return newHistory
    })
  }

  // 清空所有历史记录
  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }

  // 获取指定的历史记录
  const getAnalysis = (id: string): AnalysisHistoryItem | undefined => {
    return history.find(item => item.id === id)
  }

  // 根据查询内容搜索历史记录
  const searchHistory = (searchQuery: string): AnalysisHistoryItem[] => {
    if (!searchQuery.trim()) return history

    const query = searchQuery.toLowerCase()
    return history.filter(item => 
      item.query.toLowerCase().includes(query) ||
      item.result.answer.toLowerCase().includes(query) ||
      item.analysis_type.toLowerCase().includes(query)
    )
  }

  // 按分析类型过滤历史记录
  const filterByType = (analysisType: string): AnalysisHistoryItem[] => {
    if (!analysisType) return history
    return history.filter(item => item.analysis_type === analysisType)
  }

  // 按时间范围过滤历史记录
  const filterByTimeRange = (startTime: number, endTime: number): AnalysisHistoryItem[] => {
    return history.filter(item => 
      item.timestamp >= startTime && item.timestamp <= endTime
    )
  }

  // 获取统计信息
  const getStatistics = () => {
    const totalCount = history.length
    const typeCount: Record<string, number> = {}
    const successCount = history.filter(item => item.result.success).length
    
    history.forEach(item => {
      typeCount[item.analysis_type] = (typeCount[item.analysis_type] || 0) + 1
    })

    const mostUsedType = Object.entries(typeCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || ''

    return {
      totalCount,
      successCount,
      failureCount: totalCount - successCount,
      successRate: totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : '0',
      typeCount,
      mostUsedType,
      oldestTimestamp: history.length > 0 ? Math.min(...history.map(item => item.timestamp)) : 0,
      newestTimestamp: history.length > 0 ? Math.max(...history.map(item => item.timestamp)) : 0
    }
  }

  // 导出历史记录
  const exportHistory = (format: 'json' | 'csv' = 'json') => {
    if (format === 'json') {
      const dataStr = JSON.stringify(history, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `codewise_history_${new Date().getTime()}.json`
      a.click()
      
      URL.revokeObjectURL(url)
    } else if (format === 'csv') {
      const headers = ['时间', '查询', '分析类型', '成功', '结果摘要']
      const csvContent = [
        headers.join(','),
        ...history.map(item => [
          new Date(item.timestamp).toLocaleString(),
          `"${item.query.replace(/"/g, '""')}"`,
          item.analysis_type,
          item.result.success ? '是' : '否',
          `"${item.result.answer.substring(0, 100).replace(/"/g, '""')}..."`
        ].join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `codewise_history_${new Date().getTime()}.csv`
      a.click()
      
      URL.revokeObjectURL(url)
    }
  }

  return {
    history,
    addAnalysis,
    removeAnalysis,
    clearHistory,
    getAnalysis,
    searchHistory,
    filterByType,
    filterByTimeRange,
    getStatistics,
    exportHistory
  }
}