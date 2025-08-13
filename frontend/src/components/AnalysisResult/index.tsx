import React, { useState, useEffect, useRef } from 'react'
import { 
  Card, 
  Typography, 
  Spin, 
  Progress, 
  Space, 
  Tag, 
  Button, 
  Divider,
  Alert,
  Steps,
  Collapse,
  Badge,
  Tabs
} from 'antd'
import { 
  LoadingOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { AnalysisResponse } from '@/services/api'
import { useThemeStore } from '@/store/themeStore'
import CallChainVisualization from '@/components/CallChainVisualization'
import ContextDisplay from '@/components/ContextDisplay'
import './index.css'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse
const { TabPane } = Tabs

interface AnalysisResultProps {
  result?: AnalysisResponse
  loading?: boolean
  streaming?: boolean
  progress?: {
    current_node?: string
    iteration?: number
    visited_files_count?: number
    context_count?: number
    message?: string
  }
  onRetry?: () => void
}

interface StreamingMessage {
  type: 'progress' | 'intermediate_result' | 'final_result' | 'error'
  timestamp: number
  data: any
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({
  result,
  loading = false,
  streaming = false,
  progress,
  onRetry
}) => {
  const { isDarkMode } = useThemeStore()
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([])
  const [typewriterText, setTypewriterText] = useState('')
  const [showFullAnswer, setShowFullAnswer] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 打字机效果
  useEffect(() => {
    if (result?.answer && !streaming) {
      let index = 0
      const text = result.answer
      setTypewriterText('')
      
      const timer = setInterval(() => {
        if (index < text.length) {
          setTypewriterText(prev => prev + text[index])
          index++
        } else {
          clearInterval(timer)
        }
      }, 20)

      return () => clearInterval(timer)
    }
  }, [result?.answer, streaming])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingMessages, progress])

  const getNodeDisplayName = (node: string) => {
    const nodeNames: Record<string, string> = {
      retrieve: '检索',
      analyze: '分析',
      dependency_tracker: '依赖追踪',
      context_manager: '上下文管理',
      router: '路由判断',
      generate: '生成答案'
    }
    return nodeNames[node] || node
  }

  const getAnalysisTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      general: 'default',
      component_analysis: 'blue',
      function_analysis: 'green',
      dependency_tracking: 'purple',
      impact_analysis: 'orange',
      call_chain_analysis: 'red'
    }
    return colors[type] || 'default'
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  const exportResult = () => {
    if (!result) return
    
    const exportData = {
      query: result.query,
      answer: result.answer,
      analysis_type: result.analysis_type,
      execution_time: result.execution_time,
      visited_files: result.visited_files,
      call_chain: result.call_chain,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis_result_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 渲染加载状态
  if (loading || streaming) {
    return (
      <Card className="analysis-result-card loading">
        <div className="loading-content">
          <Spin 
            indicator={<LoadingOutlined style={{ fontSize: 32 }} />}
            size="large"
          />
          <div className="loading-info">
            <Title level={4}>正在分析中...</Title>
            
            {progress && (
              <div className="progress-info">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div className="current-step">
                    <Tag color="processing">
                      {getNodeDisplayName(progress.current_node || '')}
                    </Tag>
                    <Text>第 {progress.iteration || 1} 轮分析</Text>
                  </div>
                  
                  <Progress 
                    percent={(progress.iteration || 1) * 10} 
                    strokeColor={{
                      '0%': '#1890ff',
                      '100%': '#36cfc9',
                    }}
                    status="active"
                  />
                  
                  <div className="progress-stats">
                    <Space>
                      <Text type="secondary">已访问 {progress.visited_files_count || 0} 个文件</Text>
                      <Divider type="vertical" />
                      <Text type="secondary">收集 {progress.context_count || 0} 个上下文</Text>
                    </Space>
                  </div>
                  
                  {progress.message && (
                    <Alert 
                      message={progress.message} 
                      type="info" 
                      showIcon 
                      style={{ marginTop: 12 }}
                    />
                  )}
                </Space>
              </div>
            )}
            
            {/* 流式消息 */}
            {streamingMessages.length > 0 && (
              <div className="streaming-messages">
                {streamingMessages.map((msg, index) => (
                  <div key={index} className={`stream-message ${msg.type}`}>
                    <Space>
                      <ClockCircleOutlined />
                      <Text>{new Date(msg.timestamp).toLocaleTimeString()}</Text>
                      <Text>{JSON.stringify(msg.data)}</Text>
                    </Space>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // 渲染错误状态
  if (result && !result.success) {
    return (
      <Card className="analysis-result-card error">
        <Alert
          message="分析失败"
          description={result.answer || '未知错误'}
          type="error"
          showIcon
          action={
            onRetry && (
              <Button size="small" onClick={onRetry}>
                重试
              </Button>
            )
          }
        />
      </Card>
    )
  }

  // 渲染分析结果
  if (!result) {
    return (
      <Card className="analysis-result-card empty">
        <div className="empty-content">
          <EyeOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <Title level={4} type="secondary">等待分析结果</Title>
          <Text type="secondary">请输入问题并点击"开始分析"</Text>
        </div>
      </Card>
    )
  }

  return (
    <div className="analysis-result-container">
      {/* 结果概览 */}
      <Card className="analysis-result-card" title="分析结果">
        <div className="result-header">
          <Space wrap>
            <Tag color={getAnalysisTypeColor(result.analysis_type)}>
              {result.analysis_type}
            </Tag>
            <Tag icon={<CheckCircleOutlined />} color="success">
              分析完成
            </Tag>
            <Text type="secondary">
              耗时 {result.execution_time?.toFixed(2)}s
            </Text>
            <Text type="secondary">
              迭代 {result.iteration_count} 次
            </Text>
            <Text type="secondary">
              访问 {result.visited_files.length} 个文件
            </Text>
          </Space>
          
          <Space>
            <Button 
              type="text" 
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(result.answer)}
              title="复制答案"
            />
            <Button 
              type="text" 
              icon={<DownloadOutlined />}
              onClick={exportResult}
              title="导出结果"
            />
          </Space>
        </div>

        {/* 查询问题 */}
        <div className="query-display">
          <Title level={4}>问题</Title>
          <Paragraph className="query-text">
            {result.query}
          </Paragraph>
        </div>

        {/* 答案内容 */}
        <div className="answer-content">
          <Title level={4}>答案</Title>
          <div className="markdown-content">
            <ReactMarkdown
              components={{
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const language = match ? match[1] : 'text'
                  
                  return (
                    <SyntaxHighlighter
                      style={isDarkMode ? vscDarkPlus : oneLight}
                      language={language}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                },
                p: ({ children }) => <Paragraph>{children}</Paragraph>,
                h1: ({ children }) => <Title level={2}>{children}</Title>,
                h2: ({ children }) => <Title level={3}>{children}</Title>,
                h3: ({ children }) => <Title level={4}>{children}</Title>,
              }}
            >
              {streaming ? typewriterText : result.answer}
            </ReactMarkdown>
            
            {streaming && (
              <span className="typewriter-cursor">|</span>
            )}
          </div>
        </div>

        {/* 警告和错误 */}
        {result.warnings.length > 0 && (
          <Alert
            message="分析警告"
            description={
              <ul>
                {result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {result.errors.length > 0 && (
          <Alert
            message="分析错误"
            description={
              <ul>
                {result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 详细信息标签页 */}
      <Card className="analysis-details-card">
        <Tabs defaultActiveKey="callchain" type="card">
          <TabPane tab={
            <Badge count={result.call_chain.length} size="small">
              <span>调用链</span>
            </Badge>
          } key="callchain">
            <CallChainVisualization callChain={result.call_chain} />
          </TabPane>
          
          <TabPane tab={
            <Badge count={result.visited_files.length} size="small">
              <span>访问文件</span>
            </Badge>
          } key="files">
            <div className="visited-files">
              <Space direction="vertical" style={{ width: '100%' }}>
                {result.visited_files.map((file, index) => (
                  <Card key={index} size="small" className="file-card">
                    <Text code>{file}</Text>
                  </Card>
                ))}
              </Space>
            </div>
          </TabPane>
          
          <TabPane tab="上下文" key="context">
            <ContextDisplay contextSummary={result.context_summary} />
          </TabPane>
          
          <TabPane tab="中间结果" key="intermediate">
            <Collapse>
              {result.intermediate_results.map((intermediate, index) => (
                <Panel 
                  key={index}
                  header={`第 ${intermediate.iteration} 轮 - ${intermediate.node}`}
                >
                  <pre>{JSON.stringify(intermediate.analysis, null, 2)}</pre>
                </Panel>
              ))}
            </Collapse>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default AnalysisResult