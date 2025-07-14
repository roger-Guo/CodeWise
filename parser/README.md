# CodeWise React 代码知识图谱解析器

基于 Node.js 的 React 组件解析工具，旨在将代码库转换为结构化的**代码知识图谱 (Code Knowledge Graph)**，为 CodeWise 智能代码库检索与问答 Agent 项目提供深度分析能力。

## ✨ 功能特性

- 📄 **结构化内容提取**：提取 JSX、函数组件、类组件、Hooks 等的源代码、注释和行号。
- 🕸️ **依赖关系分析**：精确解析 `import` 语句，构建文件间的依赖关系图。
- 🗺️ **代码知识图谱构建**：每个文件作为一个节点，输出包含其内容和出度（依赖）的结构化JSON，为跨文件分析提供基础。
- 🔧 **React特性支持**：深度解析 React 组件、Hooks 调用、Props、State 等特性。
- 📝 **TypeScript支持**：完整支持 TypeScript 和 JSX/TSX 文件解析。
- 💾 **灵活输出**：支持每个文件生成一个独立的JSON，也支持生成一个包含所有文件信息的汇总图谱文件。
- ⚡ **批量处理**：支持批量解析整个 React 项目。

## 🛠 技术栈

- `@babel/parser` - JavaScript/TypeScript AST 解析，支持 JSX 语法
- `@babel/traverse` - AST 遍历，用于提取组件、Hooks、依赖关系
- `@babel/types` - AST 节点类型判断
- `@babel/preset-react` - React JSX 转换支持
- `glob` - 文件匹配
- `fs-extra` - 文件系统操作

## 📦 安装依赖

在 parser 目录下安装依赖：

```bash
cd parser
npm install
```

## 🚀 使用方法

```bash
# 解析项目，并将每个文件的结构化数据输出到 ./output 目录
node index.js ./src -o ./output

# 解析项目，并将整个项目的知识图谱信息保存到单个文件
node index.js ./src -s project-graph.json

# 解析指定模式的文件
node index.js ./src --pattern "**/*.{jsx,tsx}"

# 显示帮助信息
node index.js --help
```

## 📋 输出JSON格式 (知识图谱节点)

每个React文件会生成如下格式的JSON，代表知识图谱中的一个**节点**：

```json
{
  "filePath": "/path/to/UserProfile.jsx",
  "fileName": "UserProfile.jsx",
  "fileType": "javascript",
  "isJSX": true,
  "content": "完整的源代码内容...",
  "totalLines": 85,
  "imports": [
    {
      "source": "react",
      "line": 1,
      "specifiers": [
        { "type": "default", "imported": "default", "local": "React" },
        { "type": "named", "imported": "useState", "local": "useState" }
      ]
    }
  ],
  "exports": [
    { "type": "default", "name": "UserProfile", "line": 83 }
  ],
  "components": [
    {
      "type": "function",
      "name": "UserProfile",
      "line": 5,
      "endLine": 80,
      "params": [{ "name": "destructured", "type": "object" }],
      "isComponent": true
    }
  ],
  "hooks": [
    { "name": "useState", "line": 7, "args": 1 },
    { "name": "useEffect", "line": 12, "args": 2 },
    { "name": "useCallback", "line": 25, "args": 2 }
  ],
  "functions": [
    { "type": "arrow", "name": "handleSubmit", "line": 30, "params": [] }
  ],
  "comments": [
    { "type": "CommentBlock", "content": "用户资料组件", "line": 3, "column": 0 },
    { "type": "CommentLine", "content": "处理表单提交", "line": 29, "column": 2 }
  ],
  "dependencies": [
    {
      "source": "./UserCard",
      "resolvedPath": "/path/to/UserCard.jsx",
      "imports": [{ "type": "default", "imported": "default", "local": "UserCard" }]
    },
    {
      "source": "../utils/api",
      "resolvedPath": "/path/to/utils/api.js",
      "imports": [{ "type": "named", "imported": "fetchUser", "local": "fetchUser" }]
    }
  ]
}
```

### `dependencies` 字段说明

这是构建知识图谱的**核心**，数组中的每一项代表一条**边 (Edge)**：

- **source**: 在代码中原始的导入路径字符串。
- **resolvedPath**: 解析后的、指向项目中另一个文件节点的唯一路径。这是连接图谱节点的关键。
- **imports**: 一个数组，描述了从依赖文件中具体导入了哪些变量、组件或函数。

### React 特有字段说明

- **components**: 检测到的 React 组件（函数组件、类组件）列表
- **hooks**: React Hooks 调用列表，包括内置 Hooks 和自定义 Hooks
- **isJSX**: 标识文件是否包含 JSX 语法
- **fileType**: 文件类型（javascript 或 typescript）

## 🎯 应用场景

- **组件依赖分析**: 追踪 React 组件的依赖关系，了解组件复用情况
- **Hooks 使用统计**: 分析项目中 Hooks 的使用模式和频率
- **跨文件代码检索**: 当搜索一个组件时，可以同时找到它的定义、所有被使用的地方，以及它所依赖的其他组件
- **调用链分析**: 完整地追踪一个用户操作（如按钮点击）所触发的端到端函数调用链路，即使它跨越了多个组件文件
- **影响范围分析**: 在修改一个通用组件前，可以快速找到所有使用它的组件，评估潜在影响
- **自动化文档生成**: 基于组件的 Props、Hooks 使用、依赖关系和注释，生成更丰富的组件文档
- **性能优化指导**: 识别复杂的组件依赖链，为代码分割和懒加载提供指导

## 🔍 集成到 CodeWise：构建高级Agent

生成的代码知识图谱是构建高级代码理解Agent的基础。

### 🚀 进阶应用：结合 LangGraph 实现多文件联合分析

通过利用 `dependencies` 数据，我们可以构建一个强大的、具备**循环和推理能力**的Agent，其工作流如下：

1.  **启动节点 (Retrieve)**
    -   **任务**: 根据用户问题，通过向量检索找到最相关的**入口组件**（例如`UserProfile.jsx`）。
    -   **状态更新**: 将 `UserProfile.jsx` 的路径设置为当前分析目标。

2.  **分析节点 (Analyze)**
    -   **任务**: 读取当前目标文件的JSON数据。
        -   将其代码和注释内容添加到一个**全局上下文栈 (Context Stack)**。
        -   记录组件访问路径，形成**调用链**（例如 `UserProfile -> UserCard -> Avatar`）。
        -   检查其 `dependencies` 列表，找出所有需要进一步分析的依赖组件（例如`UserCard.jsx`）。
        -   分析 Hooks 使用情况，追踪状态管理和副作用。
    -   **状态更新**: 将新的依赖文件加入**待处理队列**。

3.  **条件路由 (Router)**
    -   **任务**: 检查**待处理队列**是否为空，或是否已达到最大分析深度。
    -   **决策**:
        -   **如果队列不为空**: 循环回到**分析节点**，处理下一个组件。
        -   **如果队列为空**: 流程结束，进入**生成答案节点**。

4.  **生成节点 (Generate)**
    -   **任务**: 此时，我们已经拥有了一个包含多个组件完整代码、Hooks 使用、Props 传递和明确调用关系的**全局上下文**。
    -   **输出**: 将这个丰满的上下文连同原始问题一起交给大语言模型（LLM），生成一个准确、完整、覆盖了整个组件调用链的答案。

### React 特有的分析能力

- **组件树分析**: 构建完整的组件层次结构，理解父子组件关系
- **状态流分析**: 追踪 state 和 props 在组件间的传递路径
- **Hooks 依赖链**: 分析 useEffect、useCallback 等 Hooks 的依赖关系
- **事件流追踪**: 从用户交互事件到状态更新的完整数据流

通过这个工作流，Agent不再局限于单个组件的信息，而是能够像一个经验丰富的 React 开发者一样，在整个组件系统的依赖关系中穿梭，从而真正"理解"React应用的运作方式。

---

## �� 许可证

MIT License 