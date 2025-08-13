import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

import Layout from '@/components/Layout'
import HomePage from '@/pages/HomePage'
import AnalysisPage from '@/pages/AnalysisPage'
import HistoryPage from '@/pages/HistoryPage'
import SettingsPage from '@/pages/SettingsPage'
import { useThemeStore } from '@/store/themeStore'
import '@/styles/responsive.css'

// 设置dayjs为中文
dayjs.locale('zh-cn')

const App: React.FC = () => {
  const { isDarkMode } = useThemeStore()

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
          colorBgContainer: isDarkMode ? '#141414' : '#ffffff',
        },
        components: {
          Layout: {
            bodyBg: isDarkMode ? '#000000' : '#f5f5f5',
            headerBg: isDarkMode ? '#141414' : '#ffffff',
            siderBg: isDarkMode ? '#141414' : '#ffffff',
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: isDarkMode ? '#1677ff' : '#e6f7ff',
            itemHoverBg: isDarkMode ? '#262626' : '#f5f5f5',
          },
        },
      }}
    >
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </Router>
    </ConfigProvider>
  )
}

export default App