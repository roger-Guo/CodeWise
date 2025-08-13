import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Form, 
  Input, 
  Switch, 
  Button, 
  Select, 
  InputNumber, 
  Divider, 
  Space, 
  Typography, 
  Row, 
  Col,
  message,
  Modal,
  Alert
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  BugOutlined
} from '@ant-design/icons'
import { useThemeStore } from '@/store/themeStore'
import { useAnalysisHistory } from '@/hooks/useAnalysisHistory'
import './index.css'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface AppSettings {
  // RAG 服务配置
  ragService: {
    baseUrl: string
    timeout: number
    retries: number
  }
  
  // Agent 服务配置
  agentService: {
    baseUrl: string
    timeout: number
    streaming: boolean
    maxTokens: number
  }
  
  // 界面配置
  ui: {
    theme: 'light' | 'dark' | 'auto'
    language: 'zh' | 'en'
    pageSize: number
    autoSave: boolean
  }
  
  // 分析配置
  analysis: {
    defaultType: string
    enableCallChain: boolean
    enableContext: boolean
    maxHistoryItems: number
  }
  
  // 高级配置
  advanced: {
    debugMode: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
    cacheEnabled: boolean
    offlineMode: boolean
  }
}

const defaultSettings: AppSettings = {
  ragService: {
    baseUrl: 'http://localhost:8001',
    timeout: 30000,
    retries: 3
  },
  agentService: {
    baseUrl: 'http://localhost:8002',
    timeout: 60000,
    streaming: true,
    maxTokens: 4000
  },
  ui: {
    theme: 'auto',
    language: 'zh',
    pageSize: 10,
    autoSave: true
  },
  analysis: {
    defaultType: 'general_analysis',
    enableCallChain: true,
    enableContext: true,
    maxHistoryItems: 100
  },
  advanced: {
    debugMode: false,
    logLevel: 'info',
    cacheEnabled: true,
    offlineMode: false
  }
}

const SETTINGS_STORAGE_KEY = 'codewise_settings'

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const { isDarkMode, toggleTheme } = useThemeStore()
  const { clearHistory, getStatistics } = useAnalysisHistory()

  // 加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
        form.setFieldsValue({ ...defaultSettings, ...parsed })
      } catch (error) {
        console.error('加载设置失败:', error)
        message.error('加载设置失败，使用默认设置')
      }
    } else {
      form.setFieldsValue(defaultSettings)
    }
  }, [form])

  // 保存设置
  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()
      const newSettings = { ...settings, ...values }
      
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings))
      setSettings(newSettings)
      
      // 应用主题设置
      if (values.ui?.theme === 'dark' && !isDarkMode) {
        toggleTheme()
      } else if (values.ui?.theme === 'light' && isDarkMode) {
        toggleTheme()
      }
      
      message.success('设置保存成功')
    } catch (error) {
      console.error('保存设置失败:', error)
      message.error('保存设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 重置设置
  const handleReset = () => {
    Modal.confirm({
      title: '确认重置',
      icon: <ExclamationCircleOutlined />,
      content: '确定要重置所有设置为默认值吗？此操作不可撤销。',
      onOk: () => {
        setSettings(defaultSettings)
        form.setFieldsValue(defaultSettings)
        localStorage.removeItem(SETTINGS_STORAGE_KEY)
        message.success('设置已重置为默认值')
      }
    })
  }

  // 测试服务连接
  const testConnection = async (serviceType: 'rag' | 'agent') => {
    const baseUrl = serviceType === 'rag' ? settings.ragService.baseUrl : settings.agentService.baseUrl
    
    try {
      setLoading(true)
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        timeout: 5000
      })
      
      if (response.ok) {
        message.success(`${serviceType.toUpperCase()} 服务连接正常`)
      } else {
        message.error(`${serviceType.toUpperCase()} 服务连接失败`)
      }
    } catch (error) {
      console.error(`测试 ${serviceType} 服务连接失败:`, error)
      message.error(`${serviceType.toUpperCase()} 服务连接失败`)
    } finally {
      setLoading(false)
    }
  }

  // 清除数据
  const handleClearData = () => {
    Modal.confirm({
      title: '确认清除数据',
      icon: <ExclamationCircleOutlined />,
      content: '确定要清除所有历史记录和缓存吗？此操作不可撤销。',
      onOk: () => {
        clearHistory()
        localStorage.removeItem('codewise_cache')
        message.success('数据清除成功')
      }
    })
  }

  const statistics = getStatistics()

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Title level={2}>
          <SettingOutlined /> 系统设置
        </Title>
        <Paragraph type="secondary">
          配置 CodeWise 系统的各项参数，优化使用体验
        </Paragraph>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
        onFinish={handleSave}
        className="settings-form"
      >
        {/* RAG 服务配置 */}
        <Card 
          title={
            <Space>
              <DatabaseOutlined />
              <span>RAG 服务配置</span>
            </Space>
          }
          className="settings-card"
          extra={
            <Button 
              size="small" 
              onClick={() => testConnection('rag')}
              loading={loading}
            >
              测试连接
            </Button>
          }
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="服务地址"
                name={['ragService', 'baseUrl']}
                rules={[{ required: true, message: '请输入RAG服务地址' }]}
              >
                <Input placeholder="http://localhost:8001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="超时时间 (ms)"
                name={['ragService', 'timeout']}
              >
                <InputNumber min={1000} max={120000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="重试次数"
                name={['ragService', 'retries']}
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Agent 服务配置 */}
        <Card 
          title={
            <Space>
              <ThunderboltOutlined />
              <span>Agent 服务配置</span>
            </Space>
          }
          className="settings-card"
          extra={
            <Button 
              size="small" 
              onClick={() => testConnection('agent')}
              loading={loading}
            >
              测试连接
            </Button>
          }
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="服务地址"
                name={['agentService', 'baseUrl']}
                rules={[{ required: true, message: '请输入Agent服务地址' }]}
              >
                <Input placeholder="http://localhost:8002" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="超时时间 (ms)"
                name={['agentService', 'timeout']}
              >
                <InputNumber min={1000} max={300000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="最大Token数"
                name={['agentService', 'maxTokens']}
              >
                <InputNumber min={500} max={8000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="启用流式输出"
                name={['agentService', 'streaming']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 界面配置 */}
        <Card 
          title="界面配置"
          className="settings-card"
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="主题模式"
                name={['ui', 'theme']}
              >
                <Select>
                  <Select.Option value="light">浅色模式</Select.Option>
                  <Select.Option value="dark">深色模式</Select.Option>
                  <Select.Option value="auto">跟随系统</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="语言"
                name={['ui', 'language']}
              >
                <Select>
                  <Select.Option value="zh">中文</Select.Option>
                  <Select.Option value="en">English</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="每页显示条数"
                name={['ui', 'pageSize']}
              >
                <InputNumber min={5} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="自动保存"
                name={['ui', 'autoSave']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 分析配置 */}
        <Card 
          title="分析配置"
          className="settings-card"
        >
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="默认分析类型"
                name={['analysis', 'defaultType']}
              >
                <Select>
                  <Select.Option value="general_analysis">通用分析</Select.Option>
                  <Select.Option value="function_analysis">函数分析</Select.Option>
                  <Select.Option value="component_analysis">组件分析</Select.Option>
                  <Select.Option value="dependency_analysis">依赖分析</Select.Option>
                  <Select.Option value="code_search">代码搜索</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="最大历史记录数"
                name={['analysis', 'maxHistoryItems']}
              >
                <InputNumber min={10} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="启用调用链"
                name={['analysis', 'enableCallChain']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="启用上下文显示"
                name={['analysis', 'enableContext']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 高级配置 */}
        <Card 
          title={
            <Space>
              <BugOutlined />
              <span>高级配置</span>
            </Space>
          }
          className="settings-card"
        >
          <Alert
            message="警告"
            description="高级配置项可能影响系统稳定性，请谨慎修改"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="调试模式"
                name={['advanced', 'debugMode']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="日志级别"
                name={['advanced', 'logLevel']}
              >
                <Select>
                  <Select.Option value="error">错误</Select.Option>
                  <Select.Option value="warn">警告</Select.Option>
                  <Select.Option value="info">信息</Select.Option>
                  <Select.Option value="debug">调试</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="启用缓存"
                name={['advanced', 'cacheEnabled']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="离线模式"
                name={['advanced', 'offlineMode']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 数据管理 */}
        <Card 
          title="数据管理"
          className="settings-card"
        >
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>历史记录统计</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      <Text type="secondary">总记录: {statistics.totalCount}</Text>
                      <Text type="secondary">成功率: {statistics.successRate}%</Text>
                    </Space>
                  </div>
                </div>
                
                <div>
                  <Text strong>存储空间使用</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      本地存储: ~{Math.round((JSON.stringify(localStorage).length / 1024))}KB
                    </Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={handleClearData}
                  block
                >
                  清除所有数据
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        <Divider />

        {/* 操作按钮 */}
        <div className="settings-actions">
          <Space size="middle">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={loading}
              size="large"
            >
              保存设置
            </Button>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              size="large"
            >
              重置为默认
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  )
}

export default SettingsPage