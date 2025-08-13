# CodeWise Frontend

基于 React 18 + TypeScript + Vite + Ant Design 构建的现代化前端应用，为 CodeWise 智能代码库检索与问答系统提供用户友好的交互界面。

## ✨ 特性

- 🚀 **现代技术栈**：React 18 + TypeScript + Vite + Ant Design 5
- 📱 **响应式设计**：支持移动端、平板端、桌面端的完美适配
- 🌙 **主题切换**：内置浅色/深色主题，支持系统主题跟随
- 🔄 **实时流式输出**：支持 Agent 分析过程的实时显示
- 📊 **数据可视化**：D3.js 驱动的调用链可视化图表
- 💾 **本地存储**：历史记录和设置的持久化存储
- 🎨 **代码高亮**：集成 react-syntax-highlighter 支持多语言代码高亮
- 🔍 **智能搜索**：历史记录搜索、过滤和分类功能

## 🏗️ 项目结构

```
frontend/
├── public/                 # 静态资源
│   ├── logo.svg           # 应用 Logo
│   └── vite.svg          # Vite 图标
├── src/
│   ├── components/        # 公共组件
│   │   ├── Layout/       # 主布局组件
│   │   ├── ServiceStatus/ # 服务状态监控
│   │   ├── AnalysisInput/ # 分析输入组件
│   │   ├── AnalysisResult/ # 分析结果展示
│   │   ├── CallChainVisualization/ # 调用链可视化
│   │   └── ContextDisplay/ # 上下文显示组件
│   ├── hooks/            # 自定义 Hooks
│   │   └── useAnalysisHistory.ts # 历史记录管理
│   ├── pages/            # 页面组件
│   │   ├── HomePage/     # 首页
│   │   ├── AnalysisPage/ # 分析页面
│   │   ├── HistoryPage/  # 历史记录页面
│   │   └── SettingsPage/ # 设置页面
│   ├── services/         # API 服务
│   │   └── api.ts        # API 接口定义
│   ├── store/            # 状态管理
│   │   └── themeStore.ts # 主题状态管理
│   ├── styles/           # 全局样式
│   │   └── responsive.css # 响应式样式
│   ├── types/            # 类型定义
│   ├── App.tsx           # 应用主组件
│   └── main.tsx          # 应用入口
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── vite.config.ts        # Vite 配置
└── README.md            # 项目文档
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 启动开发服务器

```bash
# 使用 npm
npm run dev

# 或使用 yarn
yarn dev
```

应用将在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
# 使用 npm
npm run build

# 或使用 yarn
yarn build
```

构建产物将输出到 `dist/` 目录。

### 预览生产版本

```bash
# 使用 npm
npm run preview

# 或使用 yarn
yarn preview
```

## 🔧 配置说明

### 环境变量

创建 `.env.local` 文件来配置环境变量：

```bash
# RAG 服务地址
VITE_RAG_API_URL=http://localhost:8001

# Agent 服务地址  
VITE_AGENT_API_URL=http://localhost:8002

# 应用标题
VITE_APP_TITLE=CodeWise

# 启用调试模式
VITE_DEBUG=false
```

### 服务端配置

确保以下服务正常运行：

1. **RAG 服务**：默认运行在 `http://localhost:8001`
2. **Agent 服务**：默认运行在 `http://localhost:8002`

## 📱 功能特性

### 1. 智能分析

- **多种分析类型**：函数分析、组件分析、依赖分析等
- **实时流式输出**：分析过程实时展示
- **参数配置**：支持自定义分析参数
- **示例查询**：内置常用查询示例

### 2. 结果展示

- **Markdown 渲染**：支持富文本格式的分析结果
- **代码高亮**：多语言代码语法高亮
- **调用链可视化**：D3.js 驱动的交互式图表
- **上下文显示**：结构化的上下文信息展示

### 3. 历史记录

- **本地存储**：历史记录本地持久化
- **搜索过滤**：支持关键词搜索和类型过滤
- **统计分析**：分析成功率和使用统计
- **导出功能**：支持 JSON/CSV 格式导出

### 4. 系统设置

- **服务配置**：RAG 和 Agent 服务地址配置
- **界面设置**：主题、语言、分页等设置
- **高级选项**：调试模式、缓存控制等
- **数据管理**：历史记录清理和存储管理

## 🎨 主题定制

应用支持浅色和深色两种主题，并可以跟随系统主题自动切换。

### 自定义主题色彩

在 `src/App.tsx` 中修改 `ConfigProvider` 的主题配置：

```typescript
theme={{
  token: {
    colorPrimary: '#1890ff', // 主色调
    borderRadius: 8,         // 圆角大小
    // 更多配置...
  }
}}
```

## 📊 性能优化

### 代码分割

应用使用 React.lazy() 实现路由级别的代码分割：

```typescript
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage'))
```

### 响应式设计

- 采用 CSS Grid 和 Flexbox 布局
- 针对不同屏幕尺寸优化组件显示
- 触摸友好的移动端交互

### 性能监控

在开发环境中启用 React DevTools 进行性能分析。

## 🛠️ 开发指南

### 代码规范

项目使用 ESLint + Prettier 进行代码格式化：

```bash
# 检查代码
npm run lint

# 修复代码格式
npm run lint:fix
```

### 组件开发

创建新组件时遵循以下结构：

```
ComponentName/
├── index.tsx      # 组件主文件
├── index.css      # 组件样式
└── types.ts       # 类型定义（可选）
```

### API 集成

所有 API 调用统一在 `src/services/api.ts` 中管理：

```typescript
export const agentApi = {
  analyze: (data: AnalysisRequest) => 
    request.post<AnalysisResponse>('/analyze', data),
  
  analyzeStream: (data: AnalysisRequest) =>
    fetch(`${AGENT_BASE_URL}/analyze/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
}
```

## 🔍 故障排除

### 常见问题

1. **服务连接失败**
   - 确保 RAG 和 Agent 服务正常运行
   - 检查服务端口是否正确
   - 验证 CORS 设置

2. **样式异常**
   - 清理浏览器缓存
   - 检查 Ant Design 版本兼容性
   - 验证 CSS 导入顺序

3. **构建失败**
   - 删除 `node_modules` 重新安装依赖
   - 检查 TypeScript 类型错误
   - 验证环境变量配置

### 调试技巧

1. 开启调试模式：设置 `VITE_DEBUG=true`
2. 使用 React DevTools 检查组件状态
3. 在 Network 面板查看 API 请求

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

感谢以下开源项目：

- [React](https://reactjs.org/) - 用户界面库
- [Ant Design](https://ant.design/) - 企业级 UI 设计语言
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript
- [D3.js](https://d3js.org/) - 数据驱动的文档操作库
- [React Syntax Highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) - 语法高亮组件