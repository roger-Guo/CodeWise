import ReactSimpleParser from './parseReact.js'
import fs from 'fs-extra'
import path from 'path'

/**
 * React解析器测试
 */
async function runTests() {
  const parser = new ReactSimpleParser()
  
  // 确保测试文件目录存在
  await fs.ensureDir('./test-files')
  
  // 创建测试用的React组件
  // await createTestReactFiles()
  
  console.log('开始测试React解析器...\n')
  
  // 测试单个文件解析
  console.log('=== 测试1: 函数组件解析 ===')
  const result1 = await parser.parseReactFile('./test-files/FunctionComponent.jsx')
  // console.log('解析结果:', JSON.stringify(result1, null, 2))
  
  // 使用新的分离式输出保存解析结果
  const outputDir = './output'
  
  // 确保输出目录存在
  await fs.ensureDir(outputDir)
  
  // 使用新的分离式保存方法
  await parser.saveResults(result1, outputDir)
  console.log(`✅ 解析结果已分离保存到: ${outputDir}`)
  
  
  // console.log('\n=== 测试2: 类组件解析 ===')
  // const result2 = await parser.parseReactFile('./test-files/ClassComponent.jsx')
  // console.log('解析结果:', JSON.stringify(result2, null, 2))
  
  // console.log('\n=== 测试3: TypeScript组件解析 ===')
  // const result3 = await parser.parseReactFile('./test-files/TypeScriptComponent.tsx')
  // console.log('解析结果:', JSON.stringify(result3, null, 2))
  
  // console.log('\n=== 测试4: Hooks组件解析 ===')
  // const result4 = await parser.parseReactFile('./test-files/HooksComponent.jsx')
  // console.log('解析结果:', JSON.stringify(result4, null, 2))
  
  // // 测试批量解析
  // console.log('\n=== 测试5: 批量解析测试文件 ===')
  // const batchResults = await parser.parseProject('./test-files', '**/*.{jsx,tsx}')
  // console.log(`批量解析完成，共解析 ${batchResults.length} 个文件`)
  
  // // 保存结果
  // console.log('\n=== 测试6: 保存解析结果 ===')
  // await parser.saveResults(batchResults, './output/individual')
  // await parser.saveSummaryResults(batchResults, './output/summary.json')
  
  console.log('\n测试完成！')
}

/**
 * 创建测试用的React文件
 */
async function createTestReactFiles() {
  const testFiles = {
    // 函数组件示例
    'FunctionComponent.jsx': `import React from 'react'
import { Button } from 'antd'
import './styles.css'

/**
 * 用户个人资料组件
 * @param {Object} props - 组件属性
 * @param {string} props.username - 用户名
 * @param {string} props.email - 邮箱
 */
function UserProfile({ username, email }) {
  // 处理用户点击事件
  const handleClick = () => {
    console.log('用户点击了按钮')
  }

  return (
    <div className="user-profile">
      {/* 用户信息显示 */}
      <h2>用户信息</h2>
      <p>用户名: {username}</p>
      <p>邮箱: {email}</p>
      <Button onClick={handleClick}>
        点击我
      </Button>
    </div>
  )
}

export default UserProfile`,

    // 类组件示例
    'ClassComponent.jsx': `import React, { Component } from 'react'
import UserProfile from './UserProfile'

/**
 * 用户管理页面类组件
 */
class UserManagement extends Component {
  constructor(props) {
    super(props)
    
    // 初始状态
    this.state = {
      users: [],
      loading: false,
      selectedUser: null
    }
  }

  /**
   * 组件挂载后执行
   */
  componentDidMount() {
    this.loadUsers()
  }

  /**
   * 加载用户数据
   */
  loadUsers = async () => {
    this.setState({ loading: true })
    try {
      // 模拟API调用
      const response = await fetch('/api/users')
      const users = await response.json()
      this.setState({ users, loading: false })
    } catch (error) {
      console.error('加载用户失败:', error)
      this.setState({ loading: false })
    }
  }

  /**
   * 选择用户
   */
  selectUser = (user) => {
    this.setState({ selectedUser: user })
  }

  render() {
    const { users, loading, selectedUser } = this.state

    return (
      <div className="user-management">
        <h1>用户管理</h1>
        {loading ? (
          <div>加载中...</div>
        ) : (
          <div>
            {/* 用户列表 */}
            <div className="user-list">
              {users.map(user => (
                <div key={user.id} onClick={() => this.selectUser(user)}>
                  {user.name}
                </div>
              ))}
            </div>
            
            {/* 选中用户详情 */}
            {selectedUser && (
              <UserProfile
                username={selectedUser.name}
                email={selectedUser.email}
              />
            )}
          </div>
        )}
      </div>
    )
  }
}

export default UserManagement`,

    // TypeScript组件示例
    'TypeScriptComponent.tsx': `import React, { FC, useState, useEffect } from 'react'

interface User {
  id: number
  name: string
  email: string
  avatar?: string
}

interface Props {
  userId: number
  onUserUpdate?: (user: User) => void
}

/**
 * TypeScript用户详情组件
 */
const UserDetailTS: FC<Props> = ({ userId, onUserUpdate }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // 获取用户详情
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(\`/api/users/\${userId}\`)
        if (!response.ok) {
          throw new Error('获取用户信息失败')
        }
        
        const userData: User = await response.json()
        setUser(userData)
        
        // 通知父组件用户更新
        onUserUpdate?.(userData)
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知错误')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchUser()
    }
  }, [userId, onUserUpdate])

  // 更新用户信息
  const updateUser = async (updatedData: Partial<User>) => {
    if (!user) return

    try {
      const response = await fetch(\`/api/users/\${user.id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUser(updatedUser)
        onUserUpdate?.(updatedUser)
      }
    } catch (err) {
      console.error('更新失败:', err)
    }
  }

  if (loading) return <div>加载中...</div>
  if (error) return <div>错误: {error}</div>
  if (!user) return <div>用户不存在</div>

  return (
    <div className="user-detail">
      {/* 用户头像 */}
      {user.avatar && (
        <img src={user.avatar} alt={user.name} className="avatar" />
      )}
      
      <h2>{user.name}</h2>
      <p>邮箱: {user.email}</p>
      
      <button onClick={() => updateUser({ name: '新名字' })}>
        更新姓名
      </button>
    </div>
  )
}

export default UserDetailTS`,

    // Hooks组件示例
    'HooksComponent.jsx': `import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react'
import { UserContext } from '../contexts/UserContext'

/**
 * 展示各种React Hooks用法的组件
 */
const HooksDemo = () => {
  // 状态管理
  const [count, setCount] = useState(0)
  const [name, setName] = useState('')
  const [users, setUsers] = useState([])
  
  // 上下文
  const { currentUser, updateUser } = useContext(UserContext)
  
  // 副作用
  useEffect(() => {
    // 组件挂载时执行
    console.log('组件已挂载')
    
    // 清理函数
    return () => {
      console.log('组件即将卸载')
    }
  }, [])
  
  // 监听count变化
  useEffect(() => {
    document.title = \`计数: \${count}\`
  }, [count])
  
  // 回调函数优化
  const incrementCount = useCallback(() => {
    setCount(prev => prev + 1)
  }, [])
  
  const handleNameChange = useCallback((event) => {
    setName(event.target.value)
  }, [])
  
  // 计算属性优化
  const expensiveValue = useMemo(() => {
    console.log('计算昂贵的值')
    return count * 1000 + users.length
  }, [count, users.length])
  
  // 异步加载数据
  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('加载用户失败:', error)
    }
  }, [])
  
  // 自定义Hook使用示例
  const { data: posts, loading } = useApiData('/api/posts')
  
  return (
    <div className="hooks-demo">
      <h2>React Hooks 演示</h2>
      
      {/* 计数器 */}
      <div className="counter">
        <p>计数: {count}</p>
        <button onClick={incrementCount}>增加</button>
        <p>昂贵计算结果: {expensiveValue}</p>
      </div>
      
      {/* 表单输入 */}
      <div className="form">
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="输入姓名"
        />
        <p>你好, {name || '匿名用户'}!</p>
      </div>
      
      {/* 用户信息 */}
      <div className="user-info">
        <h3>当前用户</h3>
        {currentUser ? (
          <p>{currentUser.name} ({currentUser.email})</p>
        ) : (
          <p>未登录</p>
        )}
      </div>
      
      {/* 用户列表 */}
      <div className="user-list">
        <button onClick={loadUsers}>加载用户</button>
        <ul>
          {users.map(user => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      </div>
      
      {/* API数据展示 */}
      <div className="posts">
        <h3>文章列表</h3>
        {loading ? (
          <p>加载中...</p>
        ) : (
          <ul>
            {posts?.map(post => (
              <li key={post.id}>{post.title}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * 自定义Hook示例
 */
function useApiData(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await fetch(url)
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('获取数据失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [url])
  
  return { data, loading }
}

export default HooksDemo
export { useApiData }`,

    // 高阶组件示例
    'HOCComponent.jsx': `import React from 'react'

/**
 * 高阶组件：添加认证检查
 */
const withAuth = (WrappedComponent) => {
  return function AuthenticatedComponent(props) {
    const { user } = props
    
    if (!user) {
      return <div>请先登录</div>
    }
    
    return <WrappedComponent {...props} />
  }
}

/**
 * 高阶组件：添加加载状态
 */
const withLoading = (WrappedComponent) => {
  return function LoadingComponent({ isLoading, ...props }) {
    if (isLoading) {
      return <div>加载中...</div>
    }
    
    return <WrappedComponent {...props} />
  }
}

/**
 * 基础组件
 */
const Dashboard = ({ user, data }) => {
  return (
    <div className="dashboard">
      <h1>欢迎, {user.name}!</h1>
      <div className="data-section">
        {data.map(item => (
          <div key={item.id}>{item.title}</div>
        ))}
      </div>
    </div>
  )
}

// 应用多个高阶组件
const EnhancedDashboard = withAuth(withLoading(Dashboard))

export default EnhancedDashboard
export { withAuth, withLoading, Dashboard }`
  }
  
  // 创建测试文件
  for (const [filename, content] of Object.entries(testFiles)) {
    const filePath = path.join('./test-files', filename)
    await fs.writeFile(filePath, content, 'utf-8')
    console.log(`创建测试文件: ${filename}`)
  }
}

// 运行测试
runTests().catch(console.error) 