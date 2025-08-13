import React, { useState, useMemo } from 'react'
import { 
  Card, 
  List, 
  Button, 
  Space, 
  Input, 
  Select, 
  DatePicker, 
  Tag, 
  Typography, 
  Modal, 
  Popconfirm,
  Statistic,
  Row,
  Col,
  Empty,
  Tooltip,
  message
} from 'antd'
import {
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  DownloadOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useAnalysisHistory, AnalysisHistoryItem } from '@/hooks/useAnalysisHistory'
import AnalysisResult from '@/components/AnalysisResult'
import './index.css'

const { Search } = Input
const { RangePicker } = DatePicker
const { Text, Title } = Typography

const HistoryPage: React.FC = () => {
  const { 
    history, 
    removeAnalysis, 
    clearHistory, 
    searchHistory, 
    filterByType, 
    filterByTimeRange, 
    getStatistics, 
    exportHistory 
  } = useAnalysisHistory()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [selectedItem, setSelectedItem] = useState<AnalysisHistoryItem | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  // 获取统计信息
  const statistics = useMemo(() => getStatistics(), [history])

  // 过滤历史记录
  const filteredHistory = useMemo(() => {
    let filtered = history

    // 搜索过滤
    if (searchQuery.trim()) {
      filtered = searchHistory(searchQuery)
    }

    // 类型过滤
    if (selectedType) {
      filtered = filtered.filter(item => item.analysis_type === selectedType)
    }

    // 时间范围过滤
    if (dateRange) {
      const [start, end] = dateRange
      filtered = filtered.filter(item => 
        item.timestamp >= start.startOf('day').valueOf() && 
        item.timestamp <= end.endOf('day').valueOf()
      )
    }

    return filtered
  }, [history, searchQuery, selectedType, dateRange, searchHistory])

  // 获取所有分析类型
  const analysisTypes = useMemo(() => {
    const types = new Set(history.map(item => item.analysis_type))
    return Array.from(types)
  }, [history])

  const handleViewDetail = (item: AnalysisHistoryItem) => {
    setSelectedItem(item)
    setDetailModalVisible(true)
  }

  const handleDelete = (id: string) => {
    removeAnalysis(id)
    message.success('删除成功')
  }

  const handleClearAll = () => {
    clearHistory()
    message.success('清空成功')
  }

  const handleExport = (format: 'json' | 'csv') => {
    exportHistory(format)
    message.success('导出成功')
  }

  const formatTime = (timestamp: number) => {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'function_analysis': 'blue',
      'component_analysis': 'green',
      'dependency_analysis': 'purple',
      'code_search': 'orange',
      'general_analysis': 'cyan'
    }
    return colors[type] || 'default'
  }

  return (
    <div className="history-page">
      {/* 统计面板 */}
      <Card className="statistics-card" title="分析统计">
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Statistic
              title="总分析次数"
              value={statistics.totalCount}
              prefix={<BarChartOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="成功率"
              value={statistics.successRate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="成功次数"
              value={statistics.successCount}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="失败次数"
              value={statistics.failureCount}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 筛选面板 */}
      <Card className="filter-card">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索历史记录..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={setSearchQuery}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="选择分析类型"
              value={selectedType}
              onChange={setSelectedType}
              allowClear
              style={{ width: '100%' }}
            >
              {analysisTypes.map(type => (
                <Select.Option key={type} value={type}>
                  <Tag color={getTypeColor(type)}>{type}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
              style={{ width: '100%' }}
            />
          </Col>
          
          <Col xs={24} sm={12} md={4}>
            <Space>
              <Tooltip title="导出JSON">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleExport('json')}
                  size="small"
                />
              </Tooltip>
              <Tooltip title="导出CSV">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleExport('csv')}
                  size="small"
                />
              </Tooltip>
              <Popconfirm
                title="确定要清空所有历史记录吗？"
                onConfirm={handleClearAll}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="清空所有">
                  <Button
                    icon={<ClearOutlined />}
                    danger
                    size="small"
                  />
                </Tooltip>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 历史记录列表 */}
      <Card 
        className="history-list-card"
        title={`历史记录 (${filteredHistory.length}条)`}
      >
        {filteredHistory.length === 0 ? (
          <Empty
            description="暂无历史记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            className="history-list"
            dataSource={filteredHistory}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                className={`history-item ${item.result.success ? 'success' : 'failed'}`}
                actions={[
                  <Tooltip title="查看详情">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewDetail(item)}
                    />
                  </Tooltip>,
                  <Popconfirm
                    title="确定要删除这条记录吗？"
                    onConfirm={() => handleDelete(item.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        danger
                      />
                    </Tooltip>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    item.result.success ? 
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} /> :
                      <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                  }
                  title={
                    <Space>
                      <Text strong ellipsis style={{ maxWidth: 300 }}>
                        {item.query}
                      </Text>
                      <Tag color={getTypeColor(item.analysis_type)}>
                        {item.analysis_type}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Text type="secondary" ellipsis style={{ maxWidth: 500 }}>
                        {item.result.answer.substring(0, 100)}
                        {item.result.answer.length > 100 ? '...' : ''}
                      </Text>
                      <Space>
                        <ClockCircleOutlined />
                        <Text type="secondary">{formatTime(item.timestamp)}</Text>
                        {item.result.call_chain && (
                          <Tag color="blue">
                            调用链: {item.result.call_chain.length} 步
                          </Tag>
                        )}
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="分析详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        className="detail-modal"
      >
        {selectedItem && (
          <div className="detail-content">
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>查询内容：</Text>
                  <br />
                  <Text>{selectedItem.query}</Text>
                </Col>
                <Col span={6}>
                  <Text strong>分析类型：</Text>
                  <br />
                  <Tag color={getTypeColor(selectedItem.analysis_type)}>
                    {selectedItem.analysis_type}
                  </Tag>
                </Col>
                <Col span={6}>
                  <Text strong>分析时间：</Text>
                  <br />
                  <Text>{formatTime(selectedItem.timestamp)}</Text>
                </Col>
              </Row>
            </Card>
            
            <AnalysisResult
              result={selectedItem.result}
              loading={false}
              streaming={false}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default HistoryPage