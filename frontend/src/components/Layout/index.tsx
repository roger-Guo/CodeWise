import React, { useState, useEffect } from 'react'
import { Layout as AntLayout, Menu, Button, Drawer } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  HomeOutlined,
  SearchOutlined,
  HistoryOutlined,
  SettingOutlined,
  MenuOutlined,
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons'
import { useThemeStore } from '@/store/themeStore'
import ServiceStatus from '@/components/ServiceStatus'
import './index.css'

const { Header, Sider, Content } = AntLayout

interface LayoutProps {
  children: React.ReactNode
}

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: '/analysis',
    icon: <SearchOutlined />,
    label: '智能分析',
  },
  {
    key: '/history',
    icon: <HistoryOutlined />,
    label: '历史记录',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '设置',
  },
]

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const location = useLocation()
  const navigate = useNavigate()
  const { isDarkMode, toggleTheme } = useThemeStore()

  // 监听屏幕尺寸变化
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      
      // 在移动端自动收起侧边栏
      if (mobile) {
        setCollapsed(true)
        setMobileDrawerOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
    setMobileDrawerOpen(false)
  }

  const renderMenu = (mode: 'vertical' | 'horizontal' = 'vertical') => (
    <Menu
      theme={isDarkMode ? 'dark' : 'light'}
      mode={mode}
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={handleMenuClick}
      style={{
        border: 'none',
        background: 'transparent',
      }}
    />
  )

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* 桌面端侧边栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        collapsedWidth={80}
        className="desktop-sider mobile-hidden"
        theme={isDarkMode ? 'dark' : 'light'}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div className="logo">
          <img src="/logo.svg" alt="CodeWise" />
          {!collapsed && <span>CodeWise</span>}
        </div>
        {renderMenu()}
        
        {/* 服务状态 */}
        <div className="service-status-container">
          <ServiceStatus collapsed={collapsed} />
        </div>
      </Sider>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title={
          <div className="mobile-drawer-title">
            <img src="/logo.svg" alt="CodeWise" />
            <span>CodeWise</span>
          </div>
        }
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        className="mobile-only"
        width={280}
        styles={{
          body: { padding: 0 }
        }}
      >
        {renderMenu()}
        <div style={{ padding: '16px' }}>
          <ServiceStatus />
        </div>
      </Drawer>

      <AntLayout
        style={{
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 240),
          transition: 'margin-left 0.2s',
        }}
      >
        {/* 顶部导航栏 */}
        <Header className="header">
          <div className="header-left">
            {/* 移动端菜单按钮 */}
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileDrawerOpen(true)}
              className="mobile-menu-button mobile-only"
            />
            
            {/* 面包屑导航 */}
            <div className="breadcrumb">
              <span className="current-page">
                {menuItems.find(item => item.key === location.pathname)?.label || '首页'}
              </span>
            </div>
          </div>

          <div className="header-right">
            {/* 主题切换按钮 */}
            <Button
              type="text"
              icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
              onClick={toggleTheme}
              className="theme-toggle"
              title={isDarkMode ? '切换到浅色主题' : '切换到深色主题'}
            />
          </div>
        </Header>

        {/* 主内容区域 */}
        <Content className="main-content">
          <div className="content-wrapper">
            {children}
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout