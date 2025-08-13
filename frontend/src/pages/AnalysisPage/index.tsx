import React, { useState } from 'react'
import { Row, Col, message } from 'antd'
import { useRequest } from 'ahooks'
import AnalysisInput from '@/components/AnalysisInput'
import AnalysisResult from '@/components/AnalysisResult'
import { agentApi, AnalysisRequest, AnalysisResponse } from '@/services/api'
import { useAnalysisHistory } from '@/hooks/useAnalysisHistory'
import './index.css'

const AnalysisPage: React.FC = () => {
  const [currentResult, setCurrentResult] = useState<AnalysisResponse | undefined>()
  const [streamingProgress, setStreamingProgress] = useState<any>()
  const [isStreaming, setIsStreaming] = useState(false)
  const { addAnalysis } = useAnalysisHistory()

  // 标准分析请求
  const { loading: standardLoading, run: runStandardAnalysis } = useRequest(
    agentApi.analyze,
    {
      manual: true,
      onSuccess: (result) => {
        setCurrentResult(result)
        setStreamingProgress(undefined)
        
        // 保存到历史记录
        addAnalysis({
          query: result.query,
          result,
          timestamp: Date.now(),
          analysis_type: result.analysis_type,
        })
        
        if (result.success) {
          message.success('分析完成')
        } else {
          message.error('分析失败: ' + result.answer)
        }
      },
      onError: (error) => {
        console.error('分析失败:', error)
        message.error('分析请求失败，请检查服务连接')
      }
    }
  )

  // 流式分析
  const handleStreamingAnalysis = async (analysisData: AnalysisRequest) => {
    try {
      setIsStreaming(true)
      setCurrentResult(undefined)
      setStreamingProgress(undefined)

      const response = await agentApi.analyzeStream(analysisData)
      
      if (!response.ok) {
        throw new Error('流式分析请求失败')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行

        for (const line of lines) {
          if (line.trim() === '') continue
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              switch (data.type) {
                case 'progress':
                  setStreamingProgress(data)
                  break
                  
                case 'intermediate_result':
                  // 可以在这里处理中间结果
                  console.log('中间结果:', data.result)
                  break
                  
                case 'final_result':
                  const finalResult = data.result
                  setCurrentResult(finalResult)
                  setStreamingProgress(undefined)
                  
                  // 保存到历史记录
                  if (finalResult.success) {
                    addAnalysis({
                      query: finalResult.query,
                      result: finalResult,
                      timestamp: Date.now(),
                      analysis_type: finalResult.analysis_type,
                    })
                    message.success('流式分析完成')
                  }
                  break
                  
                case 'error':
                  message.error('分析过程中出错: ' + data.error)
                  break
              }
            } catch (parseError) {
              console.error('解析流式数据失败:', parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('流式分析失败:', error)
      message.error('流式分析失败，请检查服务连接')
    } finally {
      setIsStreaming(false)
    }
  }

  const handleAnalysisSubmit = (analysisData: AnalysisRequest) => {
    // 根据配置决定使用标准分析还是流式分析
    const useStreaming = analysisData.config?.streaming || false
    
    if (useStreaming) {
      handleStreamingAnalysis(analysisData)
    } else {
      runStandardAnalysis(analysisData)
    }
  }

  const handleRetry = () => {
    if (currentResult) {
      const retryData: AnalysisRequest = {
        query: currentResult.query,
        analysis_type: currentResult.analysis_type as any,
      }
      handleAnalysisSubmit(retryData)
    }
  }

  const isLoading = standardLoading || isStreaming

  return (
    <div className="analysis-page">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={10} xl={8}>
          <div className="input-section">
            <AnalysisInput
              onSubmit={handleAnalysisSubmit}
              loading={isLoading}
            />
          </div>
        </Col>
        
        <Col xs={24} lg={14} xl={16}>
          <div className="result-section">
            <AnalysisResult
              result={currentResult}
              loading={isLoading}
              streaming={isStreaming}
              progress={streamingProgress}
              onRetry={handleRetry}
            />
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default AnalysisPage