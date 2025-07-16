# CodeWise: 智能代码库检索与问答Agent

CodeWise 是一个基于本地大语言模型和代码知识图谱的智能代码理解与问答系统。它通过深度解析代码库，构建文件间的依赖关系图谱，为开发者提供精准、上下文完整的代码检索和问答体验。

## 🚀 项目愿景

我们的目标是超越传统基于文本的搜索，构建一个能够真正“理解”代码库的AI Agent。通过结合**代码知识图谱**和**LangGraph**等高级框架，CodeWise能够：

- **追踪复杂调用链**: 从一个函数出发，完整地追踪其在整个项目中的调用路径。
- **理解跨文件逻辑**: 回答涉及多个文件协作才能完成的功能性问题。
- **评估变更影响**: 在修改一个核心模块前，精确评估其对整个代码库的潜在影响。

## 核心模块：`parser` 代码知识图谱解析器

为了实现上述目标，项目的核心是位于 `parser/` 目录下的代码解析器。它已升级为模块化设计，能够输出包含丰富上下文的结构化知识节点。

### 功能特性
- **双向依赖图谱**: 精确解析`import`/`export`，构建**正向引用**（我依赖谁）和**反向引用**（谁依赖我）的双向依赖图，是影响分析和代码溯源的关键。
- **深度代码结构分析**: 将文件解构为包含组件、函数、类的**一级定义列表**，同时通过**作用域路径**保留其逻辑层级关系。
- **全面的元数据提取**: 不仅是代码，还包括 Git 版本、分支、最后修改时间等丰富的元数据。
- **模块化JSON输出**: 输出结构清晰的模块化JSON，每个模块（如`fileMetadata`, `dependencyInfo`）职责单一，便于消费。
- **React 特性深度解析**: 深度分析组件的 Props, State, Hooks，以及内部子组件定义。

### 输出节点示例
每个文件被解析为一个知识图谱节点，其结构如下：
```json
{
  "fileMetadata": {
    "filePath": "src/components/UserProfile.jsx",
    "version": "a1b2c3d"
  },
  "fileDefinitions": [
    {
      "name": "UserProfile",
      "definitionType": "component",
      "scopePath": null,
      "details": { "hooks": ["useState"], "props": [{ "name": "userId" }] }
    },
    {
      "name": "loadUser",
      "definitionType": "function",
      "scopePath": "UserProfile"
    }
  ],
  "dependencyInfo": {
    "forwardReferences": [
      { "function": "fetchFromApi", "source": "../api/user" }
    ],
    "backwardReferences": [
      { "referencedBy": "src/pages/HomePage.jsx" }
    ]
  }
}
```

## 🤖 高级应用：结合 LangGraph 实现多文件联合分析

生成的代码知识图谱是构建高级Agent的基础。我们计划使用 **LangGraph** 框架构建一个具备循环和推理能力的Agent，其工作流如下：

1.  **启动 (Retrieve)**: 根据用户问题，向量检索找到最相关的**入口文件**。
2.  **分析 (Analyze)**: 读取文件节点的JSON数据。利用 `dependencyInfo` 中的**正向和反向引用**来扩展分析范围。通过 `forwardReferences` 找到需要继续追踪的文件，通过 `backwardReferences` 了解当前文件的调用上下文，并将信息聚合到全局上下文中。
3.  **路由 (Router)**: 检查是否还有新的、相关的依赖需要分析。
    -   **是**: 循环回到**分析**节点，处理下一个依赖文件。
    -   **否**: 进入**生成答案**节点。
4.  **生成 (Generate)**: 将包含完整调用链和多文件代码的上下文交给LLM，生成最终答案。

通过这个工作流，Agent能够像经验丰富的开发者一样，在整个代码库的依赖关系中穿梭，从而真正“理解”代码。

## 🛠️ 技术栈

- **后端**: Python 3.13.5, FastAPI
- **前端**: React 18, Vite, Ant Design React, TypeScript
- **大语言模型**: deepseek-coder-v2
- **向量数据库**: chroma_db
- **嵌入模型**: BAAI/bge-m3
- **RAG 框架**: LlamaIndex, **LangGraph (规划中)**
- **代码解析**: `@babel/parser`, `@babel/traverse`, `@babel/types`, `@babel/preset-react`
- **python包管理器**: miniconda
- **miniconda虚拟环境**: codewise
- **nodejs版本**: 20.19.3

## 📁 项目结构

```
CodeWise/
├── frontend/          # React 18 前端 + vite + Ant Design React
├── parser/            # 代码知识图谱解析器
├── backend/           # Python FastAPI 后端
├── models/            # 本地嵌入模型存储 
├── db/                # 向量数据库 chroma_db
├── data/              # 源码及处理后的JSON文件
└── scripts/           # 部署脚本
```