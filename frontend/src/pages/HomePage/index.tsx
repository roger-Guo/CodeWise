import React from 'react'
import { Card, Row, Col, Button, Typography, Space, Statistic, Timeline, Tag } from 'antd'
import { 
  SearchOutlined, 
  BranchesOutlined, 
  FileSearchOutlined,
  RocketOutlined,
  BulbOutlined,
  CodeOutlined,
  LinkOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useRequest } from 'ahooks'
import { getServiceHealth, ragApi } from '@/services/api'
import './index.css'

const { Title, Paragraph, Text } = Typography

const HomePage: React.FC = () => {
  const navigate = useNavigate()

  // 获取服务状态
  const { data: healthData } = useRequest(getServiceHealth, {
    pollingInterval: 30000,
  })

  // 获取RAG统计信息
  const { data: ragStats } = useRequest(ragApi.getStats, {
    pollingInterval: 60000,
  })

  const features = [
    {
      icon: <SearchOutlined className="feature-icon" />,
      title: '智能代码检索',
      description: '基于语义理解的代码片段搜索，支持中文查询和自然语言描述',
      color: '#1890ff'
    },
    {
      icon: <BranchesOutlined className="feature-icon" />,
      title: '调用链追踪',
      description: '深度分析函数和组件的调用关系，构建完整的依赖图谱',
      color: '#52c41a'
    },
    {
      icon: <FileSearchOutlined className="feature-icon" />,
      title: '多轮分析',
      description: '智能Agent自动发现相关代码，进行多轮迭代深化分析',
      color: '#722ed1'
    },
    {
      icon: <CodeOutlined className="feature-icon" />,
      title: '代码理解',
      description: '基于deepseek-coder-v2模型的专业代码分析和解释',
      color: '#fa8c16'
    }
  ]

  const analysisTypes = [
    { key: 'component_analysis', label: '组件分析', color: 'blue' },
    { key: 'function_analysis', label: '函数分析', color: 'green' },
    { key: 'dependency_tracking', label: '依赖追踪', color: 'purple' },
    { key: 'impact_analysis', label: '影响分析', color: 'orange' },
    { key: 'call_chain_analysis', label: '调用链分析', color: 'red' },
  ]

  const recentUpdates = [
    {
      title: 'LangGraph工作流优化',
      description: '改进多轮分析逻辑，提升调用链追踪准确性',
      time: '2024-01-15',
      type: 'optimization'
    },
    {
      title: '流式响应支持',
      description: '新增实时分析进度反馈，提升用户体验',
      time: '2024-01-12',
      type: 'feature'
    },
    {
      title: 'deepseek-coder-v2集成',
      description: '集成最新的代码专用大语言模型',
      time: '2024-01-10',
      type: 'feature'
    }
  ]

  return (
    <div className="home-page">
      {/* 英雄区域 */}
      <div className="hero-section">
        <Card className="hero-card">
          <Row gutter={[32, 32]} align="middle">
            <Col xs={24} lg={14}>
              <div className="hero-content">
                <Title level={1} className="hero-title">
                  CodeWise
                  <Text className="hero-subtitle">智能代码库检索与问答</Text>
                </Title>
                <Paragraph className="hero-description">
                  基于AI的智能代码分析平台，结合代码知识图谱和LangGraph工作流，
                  提供深度的代码理解、调用链追踪和多轮分析能力。
                  让代码分析变得更智能、更高效。
                </Paragraph>
                <Space size="large" className="hero-actions">
                  <Button 
                    type="primary" 
                    size="large" 
                    icon={<RocketOutlined />}
                    onClick={() => navigate('/analysis')}
                  >
                    开始分析
                  </Button>
                  <Button 
                    size="large" 
                    icon={<HistoryOutlined />}
                    onClick={() => navigate('/history')}
                  >
                    查看历史
                  </Button>
                </Space>
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <div className="hero-stats">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card size="small" className="stat-card">
                      <Statistic
                        title="知识库文档"
                        value={ragStats?.document_count || 0}
                        suffix="个"
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" className="stat-card">
                      <Statistic
                        title="服务状态"
                        value={healthData?.healthy ? "正常" : "异常"}
                        valueStyle={{ 
                          color: healthData?.healthy ? '#52c41a' : '#ff4d4f',
                          fontSize: '20px'
                        }}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" className="stat-card">
                      <Statistic
                        title="分析类型"
                        value={analysisTypes.length}
                        suffix="种"
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" className="stat-card">
                      <Statistic
                        title="AI模型"
                        value="deepseek-coder-v2"
                        valueStyle={{ 
                          fontSize: '14px',
                          color: '#fa8c16'
                        }}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>
        </Card>
      </div>

      {/* 功能特性 */}
      <div className="features-section">
        <Title level={2} className="section-title">
          <BulbOutlined /> 核心功能
        </Title>
        <Row gutter={[24, 24]}>
          {features.map((feature, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card className="feature-card" hoverable>
                <div className="feature-content">
                  <div 
                    className="feature-icon-wrapper"
                    style={{ backgroundColor: `${feature.color}15` }}
                  >
                    {React.cloneElement(feature.icon, { 
                      style: { color: feature.color } 
                    })}
                  </div>
                  <Title level={4} className="feature-title">
                    {feature.title}
                  </Title>
                  <Paragraph className="feature-description">
                    {feature.description}
                  </Paragraph>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 分析类型 */}
      <Row gutter={[24, 24]} className="content-section">
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <SearchOutlined />
                <span>支持的分析类型</span>
              </Space>
            }
            className="analysis-types-card"
          >
            <Space wrap>
              {analysisTypes.map(type => (
                <Tag 
                  key={type.key}
                  color={type.color}
                  className="analysis-type-tag"
                >
                  {type.label}
                </Tag>
              ))}
            </Space>
            <Paragraph className="analysis-description">
              选择不同的分析类型，获得针对性的代码分析结果。
              系统会根据分析类型调整搜索策略和分析重点。
            </Paragraph>
            <Button 
              type="primary" 
              icon={<SearchOutlined />}
              onClick={() => navigate('/analysis')}
            >
              开始分析
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>最近更新</span>
              </Space>
            }
            className="updates-card"
          >
            <Timeline
              items={recentUpdates.map(update => ({
                children: (
                  <div className="timeline-item">
                    <div className="timeline-title">{update.title}</div>
                    <div className="timeline-description">{update.description}</div>
                    <div className="timeline-time">{update.time}</div>
                  </div>
                ),
                color: update.type === 'feature' ? 'blue' : 'green'
              }))}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速开始 */}
      <div className="quick-start-section">
        <Card className="quick-start-card">
          <Title level={3} className="quick-start-title">
            <LinkOutlined /> 快速开始
          </Title>
          <Row gutter={[24, 16]}>
            <Col xs={24} sm={8}>
              <div className="quick-start-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <Title level={5}>输入问题</Title>
                  <Text>描述您想要了解的代码问题或功能</Text>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div className="quick-start-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <Title level={5}>选择分析类型</Title>
                  <Text>根据需求选择合适的分析策略</Text>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div className="quick-start-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <Title level={5}>获得答案</Title>
                  <Text>查看详细分析结果和调用链</Text>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  )
}

export default HomePage