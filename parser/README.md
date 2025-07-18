# CodeWise 代码知识图谱解析器

基于 Node.js 的 React 代码解析工具，旨在将代码库转换为结构化的**代码知识图谱 (Code Knowledge Graph)**，为 CodeWise 智能代码库检索与问答 Agent 项目提供深度分析能力。

## ✨ 功能特性

- 📄 **全面的元数据提取**: 不仅是文件内容，还包括 Git 版本、分支、作者等丰富的元数据。
- 🕸️ **双向依赖图谱**: 精确解析 `import`/`export`，并构建**正向引用**（我依赖谁）和**反向引用**（谁依赖我）的双向依赖图。
- 🗺️ **深度代码结构分析**: 将文件解构为包含组件、函数、类、变量的**一级定义列表**，同时通过**作用域路径**保留其逻辑层级。
- 🔧 **React 特性深度解析**: 深度分析组件的 Props, State, Hooks，以及内部子组件定义。
- 🚀 **多平台路由信息**: 解析代码中的路由定义，关联 H5, 小程序, App 的访问路径。
- 💾 **模块化JSON输出**: 输出结构清晰的模块化JSON，每个模块（`fileMetadata`, `dependencyInfo` 等）职责单一，便于消费。
- 📝 **TypeScript与TSX/JSX全面支持**。
- ⚡ **批量处理与灵活输出**。

## 🛠 技术栈

- `@babel/parser` - JavaScript/TypeScript AST 解析，支持 JSX 语法
- `@babel/traverse` - AST 遍历，用于提取组件、Hooks、依赖关系
- `@babel/types` - AST 节点类型判断
- `@babel/preset-react` - React JSX 转换支持
- `glob` - 文件匹配
- `fs-extra` - 文件系统操作

## 📦 安装与使用

```bash
# 在 parser 目录下安装依赖
cd parser
npm install

# 使用CLI解析项目（传统单文件输出模式）
node index.js ./src --output ./output --summary project-graph.json

# 使用两级分离式输出模式（推荐）
node test.js  # 自动为每个定义生成独立的JSON文件

# 批量处理整个项目文件夹
node test.js  # 处理 test-files 目录下的所有 JSX/TSX/JS/TS 文件

# 使用CLI工具批量处理项目（推荐）
node project-parser.js                                    # 解析默认项目
node project-parser.js ./src                              # 解析指定目录
node project-parser.js -o ./results                       # 指定输出目录
node project-parser.js --pattern "src/**/*.{jsx,tsx}"     # 自定义文件模式
```

### 🚀 批量处理项目文件夹

解析器支持批量处理整个项目文件夹，自动识别所有符合条件的文件：

```bash
# 处理指定项目文件夹
node test.js

# 输出结构:
output/
├── project-summary.json          # 项目汇总信息
├── [相对路径]/[文件名]/          # 保持原始项目路径结构
│   ├── [文件名].json            # 完整文件信息
│   ├── top-level/               # 顶层定义
│   │   ├── [名称]_component.json
│   │   ├── [名称]_function.json
│   │   └── [名称]_variable.json
│   └── nested/                  # 嵌套定义
│       ├── [作用域]_[名称]_function.json
│       └── [作用域]_[名称]_component.json
└── [相对路径]/[文件名]/
    ├── [文件名].json
    ├── top-level/
    └── nested/

# 示例输出结构:
output/
├── project-summary.json
├── utils/
│   └── utils/
│       ├── utils.json
│       ├── top-level/
│       └── nested/
├── src/
│   ├── components/
│   │   └── index/
│   │       ├── index.json
│   │       ├── top-level/
│   │       └── nested/
│   ├── pages/
│   │   └── index/
│   │       ├── index.json
│   │       ├── top-level/
│   │       └── nested/
│   └── utils/
│       └── index/
│           ├── index.json
│           ├── top-level/
│           └── nested/
```

### 📊 项目汇总信息

批量处理会生成 `project-summary.json` 文件，包含：

```json
{
  "projectPath": "./test-files",
  "totalFiles": 3,
  "successCount": 3,
  "errorCount": 0,
  "fileTypes": {
    "jsx": 2,
    "tsx": 0,
    "js": 1,
    "ts": 0
  },
  "statistics": {
    "totalComponents": 2,
    "totalFunctions": 5,
    "totalClasses": 0,
    "totalVariables": 0,
    "totalImports": 6,
    "totalExports": 5
  },
  "files": [
    {
      "fileName": "FunctionComponent.jsx",
      "filePath": "test-files/FunctionComponent.jsx",
      "fileType": "javascript",
      "isJSX": true,
      "components": 1,
      "functions": 3,
      "imports": 4,
      "exports": 2
    }
  ]
}
```

## 📋 输出模式

### 🔄 两级分离式输出 (推荐模式)

解析器采用**两级分离式输出架构**，将每个文件的所有定义（类、函数、组件、导出变量）按照作用域层级分类，并为每个定义生成独立的JSON文件：

**目录结构:**
```
output/
└── [文件名]/
    ├── top-level/           # 顶层定义
    │   ├── [名称]_component.json
    │   ├── [名称]_function.json
    │   └── [名称]_variable.json
    └── nested/              # 嵌套定义
        ├── [作用域]_[名称]_function.json
        └── [作用域]_[名称]_component.json
```

**优势:**
- 🎯 **精细化管理**: 每个定义都是独立的知识图谱节点
- ⚡ **性能优化**: 按需加载，避免加载整个文件
- 🔍 **精确分析**: 支持单个函数/组件的深度分析
- 📊 **影响追踪**: 通过依赖图谱精确分析代码修改影响

详细文档: [两级分离式输出架构](./src/encoder/two-tier-output/README.md)

### 📄 传统单文件输出

每个源文件生成一个完整的JSON，包含该文件的所有信息：

```json
{
  "fileMetadata": { /* 文件元数据 */ },
  "fileDefinitions": [ /* 文件内部定义 (组件,函数等) */ ],
  "dependencyInfo": { /* 导入导出依赖 */ },
  "routingInfo": { /* 路由信息 */ }
}
```

### 完整示例

以下是一个简化的 `UserProfile.jsx` 组件解析后的输出示例：

```json
{
  "fileMetadata": {
    "filePath": "src/components/UserProfile.jsx",
    "repositoryName": "CodeWise",
    "version": "a1b2c3d",
    "branch": "main"
  },
  "fileDefinitions": [
    {
      "name": "UserProfile",
      "qualifiedName": "UserProfile.jsx::UserProfile",
      "definitionType": "component",
      "scopePath": null,
      "isTopLevel": true,
      "startLine": 5,
      "endLine": 20,
      "description": "用户资料卡片",
      "exportInfo": { "isExported": true, "type": "default" },
      "details": { }
    },
    {
      "name": "loadUser",
      "qualifiedName": "UserProfile.jsx::UserProfile.loadUser",
      "definitionType": "function",
      "scopePath": "UserProfile",
      "isTopLevel": false,
      "startLine": 8,
      "endLine": 11,
      "description": "加载用户信息的函数",
      "exportInfo": { "isExported": false, "type": null },
      "details": { "isAsync": true, "params": [] }
    }
  ],
  "dependencyInfo": {
    "forwardReferences": [
      {
        "type": "function_call",
        "function": "fetchFromApi",
        "source": "../api/user",
        "resolvedPath": "src/api/user.js"
      }
    ],
    "backwardReferences": [
      {
        "referencedBy": "src/pages/HomePage.jsx",
        "function": "HomePage",
        "type": "jsx_element"
      }
    ]
  },
  "routingInfo": {
    "routes": [
      { "platform": "h5", "path": "/user/:userId" }
    ]
    }
}
```

### 核心模块说明

#### `fileDefinitions` - 内部结构的核心

此模块解决了多级子模块的复杂性。它将文件内所有定义（组件、函数、类、变量）**扁平化**到一个数组中。

- **扁平化结构**: 不再使用嵌套JSON，所有定义都是一级列表成员，便于查询。
- **`scopePath`**: 通过 `scopePath` 字段（如 `"UserProfile"`）指明每个定义的逻辑父级，完美保留了层级关系。
- **`isTopLevel`**: 快速筛选文件顶层定义。
- **`qualifiedName`**: 全局唯一名称，是信息索引的关键。

#### `dependencyInfo` - 外部关系的核心

此模块专门处理文件间的依赖关系，并构建**双向引用**图。

- **`forwardReferences` (正向引用)**: 回答“**我依赖谁？**”。列出了当前文件直接调用或导入的所有外部模块。
- **`backwardReferences` (反向引用)**: 回答“**谁依赖我？**”。列出了项目中所有直接使用当前文件的其他文件。这是进行**影响分析**和**代码溯源**的利器。

## 🎯 应用场景

- **双向依赖追溯**: "修改 `fetchFromApi` 会影响哪些UI组件？" (反向查找)。"`UserProfile` 组件正常工作需要哪些API？" (正向查找)。
- **精准的影响范围分析**: "如果我废弃 `userId` 这个 prop，会破坏哪些页面？" (通过反向引用找到所有使用 `UserProfile` 的地方，并分析其传参)。
- **组件内部逻辑理解**: " `UserProfile` 组件内定义了哪些辅助函数？" (查询 `fileDefinitions` where `scopePath` is `UserProfile`)。
- **自动化文档与测试**: 基于 `fileDefinitions` 中的 `description`  等信息，自动生成组件文档或测试框架。

## 🔍 集成到 CodeWise：构建高级Agent

这个结构化的知识图谱是构建高级代码理解Agent的基石。

### 🚀 进阶应用：结合 LangGraph 实现多文件联合分析

通过利用 `dependencyInfo` 和 `fileDefinitions`，Agent 的工作流将更加强大：

1.  **启动节点 (Retrieve)**
    -   根据用户问题，向量检索到入口文件（如`UserProfile.jsx`）。

2.  **分析节点 (Analyze)**
    -   读取目标文件的JSON数据。
    -   将`fileDefinitions`中的信息加入**全局上下文**。
    -   检查 `dependencyInfo.forwardReferences`，将依赖文件加入**待分析队列**。
    -   检查 `dependencyInfo.backwardReferences`，了解其调用来源，丰富上下文。

3.  **条件路由 (Router)**
    -   如果**待分析队列**不为空，则循环回到**分析节点**。
    -   否则，进入**生成节点**。

4.  **生成节点 (Generate)**
    -   此时，Agent 已拥有一个包含**双向依赖关系**、**组件内部定义**和**跨文件调用链**的超图上下文 (Hyper-graph Context)。
    -   将这个丰满的上下文连同原始问题一起交给大语言模型（LLM），生成一个覆盖了完整调用链路的、高度准确的答案。

---

## ⚖️ 许可证

MIT License 