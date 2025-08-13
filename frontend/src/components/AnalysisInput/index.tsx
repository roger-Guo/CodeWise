import React, { useState } from 'react'
import { 
  Card, 
  Input, 
  Button, 
  Select, 
  Row, 
  Col, 
  Space, 
  Form, 
  Slider, 
  Switch,
  Divider,
  Tag,
  Tooltip
} from 'antd'
import { 
  SearchOutlined, 
  SendOutlined, 
  SettingOutlined,
  InfoCircleOutlined,
  ClearOutlined
} from '@ant-design/icons'
import { AnalysisRequest } from '@/services/api'
import './index.css'

const { TextArea } = Input
const { Option } = Select

interface AnalysisInputProps {
  onSubmit: (data: AnalysisRequest) => void
  loading?: boolean
  disabled?: boolean
}

const analysisTypes = [
  {
    value: 'general',
    label: '通用分析',
    description: '适用于一般性的代码问题和功能询问',
    color: 'default'
  },
  {
    value: 'component_analysis',
    label: '组件分析',
    description: '专门分析React组件的结构、Props、State等',
    color: 'blue'
  },
  {
    value: 'function_analysis',
    label: '函数分析',
    description: '深入分析函数的定义、参数、调用关系',
    color: 'green'
  },
  {
    value: 'dependency_tracking',
    label: '依赖追踪',
    description: '追踪模块间的导入导出和依赖关系',
    color: 'purple'
  },
  {
    value: 'impact_analysis',
    label: '影响分析',
    description: '分析代码修改对其他部分的潜在影响',
    color: 'orange'
  },
  {
    value: 'call_chain_analysis',
    label: '调用链分析',
    description: '构建完整的函数调用链路',
    color: 'red'
  }
]

const exampleQueries = [
  'React组件中useState Hook的使用方法',
  '查找所有导入lodash的文件',
  '分析UserProfile组件的依赖关系',
  '这个函数在项目中被哪些地方调用？',
  '如何优化这段代码的性能？',
  '解释这个组件的生命周期'
]

const AnalysisInput: React.FC<AnalysisInputProps> = ({ 
  onSubmit, 
  loading = false, 
  disabled = false 
}) => {
  const [form] = Form.useForm()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState('')

  const handleSubmit = (values: any) => {
    const analysisData: AnalysisRequest = {
      query: values.query,
      analysis_type: values.analysis_type || 'general',
      max_iterations: values.max_iterations,
      config: {
        context_window_size: values.context_window_size,
        similarity_threshold: values.similarity_threshold / 100,
        parallel_search: values.parallel_search,
      }
    }
    
    onSubmit(analysisData)
  }

  const handleExampleClick = (query: string) => {
    setSelectedQuery(query)
    form.setFieldValue('query', query)
  }

  const handleClear = () => {
    form.resetFields()
    setSelectedQuery('')
  }

  const currentAnalysisType = Form.useWatch('analysis_type', form) || 'general'
  const selectedTypeInfo = analysisTypes.find(t => t.value === currentAnalysisType)

  return (
    <Card className="analysis-input-card">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          analysis_type: 'general',
          max_iterations: 5,
          context_window_size: 8000,
          similarity_threshold: 70,
          parallel_search: true,
        }}
        disabled={disabled}
      >
        {/* 示例查询 */}
        <div className="example-queries">
          <div className="example-label">
            <InfoCircleOutlined /> 示例问题：
          </div>
          <Space wrap>
            {exampleQueries.map((query, index) => (
              <Tag
                key={index}
                className={`example-tag ${selectedQuery === query ? 'selected' : ''}`}
                onClick={() => handleExampleClick(query)}
                style={{ cursor: 'pointer', marginBottom: '8px' }}
              >
                {query}
              </Tag>
            ))}
          </Space>
        </div>

        {/* 查询输入 */}
        <Form.Item
          name="query"
          label={
            <Space>
              <SearchOutlined />
              <span>请输入您的问题</span>
            </Space>
          }
          rules={[
            { required: true, message: '请输入查询问题' },
            { min: 5, message: '问题至少5个字符' },
            { max: 500, message: '问题不能超过500个字符' }
          ]}
        >
          <TextArea
            placeholder="例如：React组件中useState的使用方法，或者查找特定函数的调用关系..."
            rows={4}
            showCount
            maxLength={500}
            className="query-textarea"
          />
        </Form.Item>

        <Row gutter={16}>
          {/* 分析类型选择 */}
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="analysis_type"
              label="分析类型"
            >
              <Select
                placeholder="选择分析类型"
                size="large"
              >
                {analysisTypes.map(type => (
                  <Option key={type.value} value={type.value}>
                    <Space>
                      <Tag color={type.color} style={{ margin: 0 }}>
                        {type.label}
                      </Tag>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          {/* 最大迭代次数 */}
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="max_iterations"
              label="最大迭代次数"
            >
              <Select size="large">
                <Option value={3}>3次 (快速)</Option>
                <Option value={5}>5次 (平衡)</Option>
                <Option value={8}>8次 (深度)</Option>
                <Option value={10}>10次 (全面)</Option>
              </Select>
            </Form.Item>
          </Col>

          {/* 操作按钮 */}
          <Col xs={24} md={8}>
            <Form.Item label=" " className="action-form-item">
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  icon={<SendOutlined />}
                  loading={loading}
                  className="submit-button"
                >
                  开始分析
                </Button>
                <Button
                  size="large"
                  icon={<ClearOutlined />}
                  onClick={handleClear}
                  disabled={loading}
                >
                  清空
                </Button>
                <Button
                  size="large"
                  icon={<SettingOutlined />}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  type={showAdvanced ? 'primary' : 'default'}
                >
                  {showAdvanced ? '收起' : '高级'}
                </Button>
              </Space>
            </Form.Item>
          </Col>
        </Row>

        {/* 分析类型说明 */}
        {selectedTypeInfo && (
          <div className="type-description">
            <Tag color={selectedTypeInfo.color}>
              {selectedTypeInfo.label}
            </Tag>
            <span className="description-text">
              {selectedTypeInfo.description}
            </span>
          </div>
        )}

        {/* 高级配置 */}
        {showAdvanced && (
          <div className="advanced-config">
            <Divider>高级配置</Divider>
            
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="context_window_size"
                  label="上下文窗口大小"
                >
                  <Slider
                    min={2000}
                    max={16000}
                    step={1000}
                    marks={{
                      2000: '2K',
                      8000: '8K',
                      16000: '16K'
                    }}
                    tooltip={{
                      formatter: (value) => `${value} 字符`
                    }}
                  />
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={12}>
                <Form.Item
                  name="similarity_threshold"
                  label="相似度阈值"
                >
                  <Slider
                    min={50}
                    max={95}
                    step={5}
                    marks={{
                      50: '50%',
                      70: '70%',
                      95: '95%'
                    }}
                    tooltip={{
                      formatter: (value) => `${value}%`
                    }}
                  />
                </Form.Item>
              </Col>
              
              <Col xs={24}>
                <Form.Item
                  name="parallel_search"
                  label="并行搜索"
                  valuePropName="checked"
                >
                  <Switch 
                    checkedChildren="开启"
                    unCheckedChildren="关闭"
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>
        )}
      </Form>

      {/* 分析说明 */}
      <div className="analysis-tips">
        <Tooltip title="获得更好分析结果的建议">
          <InfoCircleOutlined className="tips-icon" />
        </Tooltip>
        <Space wrap className="tips-content">
          <span>💡 描述具体的功能或问题</span>
          <span>🎯 选择合适的分析类型</span>
          <span>🔄 可以多轮提问深入了解</span>
        </Space>
      </div>
    </Card>
  )
}

export default AnalysisInput