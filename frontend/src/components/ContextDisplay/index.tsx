import React, { useState } from 'react'
import { Card, Typography, Space, Tag, Button, Collapse, Empty } from 'antd'
import { 
  CodeOutlined, 
  FileTextOutlined, 
  BranchesOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useThemeStore } from '@/store/themeStore'
import './index.css'

const { Text, Paragraph } = Typography
const { Panel } = Collapse

interface ContextDisplayProps {
  contextSummary: string
}

interface ParsedContext {
  type: 'file' | 'search' | 'dependency' | 'analysis'
  title: string
  content: string
  metadata?: Record<string, any>
  codeBlocks?: Array<{
    language: string
    code: string
    filename?: string
  }>
}

const ContextDisplay: React.FC<ContextDisplayProps> = ({ contextSummary }) => {
  const { isDarkMode } = useThemeStore()
  const [expandedPanels, setExpandedPanels] = useState<string[]>(['0'])
  const [showRaw, setShowRaw] = useState(false)

  const parseContextSummary = (summary: string): ParsedContext[] => {
    if (!summary) return []

    const contexts: ParsedContext[] = []
    
    // 按双换行分割不同的上下文段落
    const sections = summary.split(/\n\s*\n/).filter(section => section.trim())
    
    sections.forEach((section, index) => {
      const lines = section.trim().split('\n')
      const firstLine = lines[0]
      
      let type: ParsedContext['type'] = 'analysis'
      let title = `上下文 ${index + 1}`
      
      // 根据内容判断类型
      if (firstLine.includes('##')) {
        title = firstLine.replace(/^#+\s*/, '')
        
        if (title.includes('search') || title.includes('搜索')) {
          type = 'search'
        } else if (title.includes('dependency') || title.includes('依赖')) {
          type = 'dependency'
        } else if (title.includes('file') || title.includes('文件')) {
          type = 'file'
        }
      } else if (section.includes('文件路径:') || section.includes('filePath')) {
        type = 'file'
        const pathMatch = section.match(/文件路径:\s*(.+?)(?:\n|$)/)
        if (pathMatch) {
          title = pathMatch[1].trim()
        }
      } else if (section.includes('依赖模块:') || section.includes('导入')) {
        type = 'dependency'
        title = '依赖关系'
      }

      // 提取代码块
      const codeBlocks: ParsedContext['codeBlocks'] = []
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
      let match
      
      while ((match = codeBlockRegex.exec(section)) !== null) {
        codeBlocks.push({
          language: match[1] || 'javascript',
          code: match[2].trim()
        })
      }

      // 移除代码块后的内容
      const contentWithoutCode = section.replace(/```[\s\S]*?```/g, '').trim()
      
      contexts.push({
        type,
        title,
        content: contentWithoutCode,
        codeBlocks
      })
    })

    return contexts
  }

  const contexts = parseContextSummary(contextSummary)

  const getContextIcon = (type: ParsedContext['type']) => {
    const icons = {
      file: <FileTextOutlined />,
      search: <EyeOutlined />,
      dependency: <BranchesOutlined />,
      analysis: <CodeOutlined />
    }
    return icons[type]
  }

  const getContextColor = (type: ParsedContext['type']) => {
    const colors = {
      file: 'blue',
      search: 'green',
      dependency: 'purple',
      analysis: 'orange'
    }
    return colors[type]
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  const renderCodeBlock = (block: ParsedContext['codeBlocks'][0], index: number) => (
    <div key={index} className="code-block-container">
      <div className="code-block-header">
        <Space>
          <Tag color="blue">{block.language}</Tag>
          {block.filename && (
            <Text type="secondary" className="filename">
              {block.filename}
            </Text>
          )}
        </Space>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(block.code)}
          title="复制代码"
        />
      </div>
      <div className="code-block-content">
        <SyntaxHighlighter
          language={block.language}
          style={isDarkMode ? vscDarkPlus : oneLight}
          customStyle={{
            margin: 0,
            borderRadius: '0 0 8px 8px',
            fontSize: '13px'
          }}
          showLineNumbers
          wrapLines
        >
          {block.code}
        </SyntaxHighlighter>
      </div>
    </div>
  )

  if (!contextSummary || contextSummary.trim() === '') {
    return (
      <Card className="context-display-card">
        <Empty
          description="暂无上下文信息"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    )
  }

  return (
    <div className="context-display">
      {/* 控制面板 */}
      <div className="context-controls">
        <Space>
          <Button
            type={showRaw ? 'primary' : 'default'}
            size="small"
            icon={showRaw ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? '结构化视图' : '原始内容'}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(contextSummary)}
          >
            复制全部
          </Button>
        </Space>
      </div>

      {showRaw ? (
        /* 原始内容显示 */
        <Card className="raw-content-card">
          <pre className="raw-content">
            {contextSummary}
          </pre>
        </Card>
      ) : (
        /* 结构化显示 */
        <div className="structured-content">
          {contexts.length > 0 ? (
            <Collapse
              activeKey={expandedPanels}
              onChange={(keys) => setExpandedPanels(keys as string[])}
              ghost
            >
              {contexts.map((context, index) => (
                <Panel
                  key={index.toString()}
                  header={
                    <Space>
                      {getContextIcon(context.type)}
                      <Tag color={getContextColor(context.type)}>
                        {context.type}
                      </Tag>
                      <Text strong>{context.title}</Text>
                    </Space>
                  }
                  className="context-panel"
                >
                  <div className="context-content">
                    {context.content && (
                      <div className="context-text">
                        <Paragraph>
                          {context.content.split('\n').map((line, lineIndex) => (
                            <div key={lineIndex}>
                              {line.trim() === '' ? <br /> : line}
                            </div>
                          ))}
                        </Paragraph>
                      </div>
                    )}
                    
                    {context.codeBlocks && context.codeBlocks.length > 0 && (
                      <div className="code-blocks">
                        {context.codeBlocks.map((block, blockIndex) =>
                          renderCodeBlock(block, blockIndex)
                        )}
                      </div>
                    )}
                  </div>
                </Panel>
              ))}
            </Collapse>
          ) : (
            <Card>
              <div className="fallback-content">
                <Text type="secondary">无法解析上下文结构，显示原始内容：</Text>
                <pre className="fallback-raw">
                  {contextSummary}
                </pre>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* 统计信息 */}
      <div className="context-stats">
        <Space>
          <Text type="secondary">
            共 {contexts.length} 个上下文段落
          </Text>
          <Text type="secondary">
            包含 {contexts.reduce((sum, ctx) => sum + (ctx.codeBlocks?.length || 0), 0)} 个代码块
          </Text>
          <Text type="secondary">
            总计 {contextSummary.length} 字符
          </Text>
        </Space>
      </div>
    </div>
  )
}

export default ContextDisplay