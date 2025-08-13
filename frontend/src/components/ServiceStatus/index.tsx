import React, { useState, useEffect } from 'react'
import { Card, Badge, Tooltip, Space, Button, Popover } from 'antd'
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  CloseCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useRequest } from 'ahooks'
import { getServiceHealth, getServiceStatus } from '@/services/api'
import './index.css'

interface ServiceStatusProps {
  collapsed?: boolean
}

const ServiceStatus: React.FC<ServiceStatusProps> = ({ collapsed = false }) => {
  const [detailsVisible, setDetailsVisible] = useState(false)

  // 获取服务健康状态
  const { data: healthData, loading: healthLoading, refresh: refreshHealth } = useRequest(
    getServiceHealth,
    {
      pollingInterval: 30000, // 30秒轮询
      onError: (error) => {
        console.error('获取服务健康状态失败:', error)
      }
    }
  )

  // 获取服务详细状态
  const { data: statusData, loading: statusLoading, refresh: refreshStatus } = useRequest(
    getServiceStatus,
    {
      pollingInterval: 60000, // 60秒轮询
      manual: true,
    }
  )

  useEffect(() => {
    if (detailsVisible) {
      refreshStatus()
    }
  }, [detailsVisible, refreshStatus])

  const getStatusInfo = () => {
    if (healthLoading) {
      return {
        status: 'processing',
        text: '检查中',
        color: '#1890ff'
      }
    }

    if (!healthData) {
      return {
        status: 'error',
        text: '离线',
        color: '#ff4d4f'
      }
    }

    if (healthData.healthy) {
      return {
        status: 'success',
        text: '正常',
        color: '#52c41a'
      }
    } else {
      return {
        status: 'warning',
        text: '异常',
        color: '#faad14'
      }
    }
  }

  const statusInfo = getStatusInfo()

  const renderServiceDetail = (serviceName: string, serviceData: any) => {
    const isHealthy = serviceData?.status === 'healthy'
    const status = isHealthy ? 'success' : 'error'
    const icon = isHealthy ? <CheckCircleOutlined /> : <CloseCircleOutlined />
    
    return (
      <div key={serviceName} className="service-detail-item">
        <Space>
          <Badge 
            status={status} 
            icon={icon} 
          />
          <span className="service-name">{serviceName}</span>
          <span className="service-status">
            {serviceData?.status || '未知'}
          </span>
        </Space>
      </div>
    )
  }

  const detailsContent = (
    <div className="service-details">
      <div className="service-details-header">
        <Space>
          <span>服务状态详情</span>
          <Button 
            type="text" 
            size="small" 
            icon={<ReloadOutlined />}
            onClick={() => {
              refreshHealth()
              refreshStatus()
            }}
            loading={healthLoading || statusLoading}
          />
        </Space>
      </div>
      
      <div className="service-details-content">
        {healthData?.services ? (
          Object.entries(healthData.services).map(([serviceName, serviceData]) => 
            renderServiceDetail(serviceName, serviceData)
          )
        ) : (
          <div className="no-data">暂无服务信息</div>
        )}
        
        {statusData && (
          <div className="additional-info">
            <div className="info-item">
              <span className="info-label">LLM模型:</span>
              <span className="info-value">{statusData.ollama_model || '未知'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">检查时间:</span>
              <span className="info-value">
                {statusData.timestamp ? 
                  new Date(statusData.timestamp).toLocaleTimeString('zh-CN') : 
                  '未知'
                }
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (collapsed) {
    return (
      <Tooltip title={`服务状态: ${statusInfo.text}`} placement="right">
        <div className="service-status-collapsed">
          <Popover
            content={detailsContent}
            title="服务状态"
            trigger="click"
            placement="rightBottom"
            open={detailsVisible}
            onOpenChange={setDetailsVisible}
          >
            <Button
              type="text"
              size="small"
              className={`status-button status-${statusInfo.status}`}
            >
              <div 
                className={`status-indicator ${statusInfo.status}`}
                style={{ backgroundColor: statusInfo.color }}
              />
            </Button>
          </Popover>
        </div>
      </Tooltip>
    )
  }

  return (
    <Card
      size="small"
      className="service-status-card"
      styles={{
        body: { padding: '12px 16px' }
      }}
    >
      <div className="service-status-content">
        <Space align="center">
          <div 
            className={`status-indicator ${statusInfo.status} pulse`}
            style={{ backgroundColor: statusInfo.color }}
          />
          <span className="status-text">服务状态</span>
          <Badge 
            status={statusInfo.status as any}
            text={statusInfo.text}
          />
        </Space>
        
        <Popover
          content={detailsContent}
          title="服务状态详情"
          trigger="click"
          placement="topLeft"
          open={detailsVisible}
          onOpenChange={setDetailsVisible}
        >
          <Button 
            type="text" 
            size="small" 
            icon={<InfoCircleOutlined />}
            className="details-button"
          />
        </Popover>
      </div>
    </Card>
  )
}

export default ServiceStatus