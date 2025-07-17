# 依赖关系编码器 (`dependencies`)

## 1. 概述 (Overview)

`dependencies` 编码器是 CodeWise 知识图谱的“神经网络”。它负责构建连接各个文件节点的**边 (Edges)**，精确地描绘出代码模块之间错综复杂的调用与被调用关系。

此编码器生成两个核心部分：
- **`forwardReferences` (正向引用)**: 回答 “当前文件依赖了谁？”
- **`backwardReferences` (反向引用)**: 回答 “谁依赖了当前文件？”

通过这种双向的依赖视图，我们能够实现真正的全链路代码理解和影响分析。

## 2. 设计目标 (Goals)

- **构建双向图谱**: 同时提供出度和入度的依赖信息，形成完整的知识图谱。
- **精准影响分析**: 通过 `backwardReferences`，能够瞬间定位一个模块的所有被调用点，精确评估修改的潜在风险。
- **调用链追踪**: 通过 `forwardReferences`，可以从一个入口函数开始，逐层深入，追踪完整的业务逻辑实现。
- **关系类型化**: 不仅知道有依赖，还知道依赖的**类型**（是函数调用、组件使用还是模块导入），提供更丰富的上下文。

## 3. JSON 结构定义

### `dependencies` 对象

| 字段 (Field) | 类型 (Type) | 描述 |
| :--- | :--- | :--- |
| `forwardReferences` | `ForwardReference[]` | 正向引用列表，描述当前文件**使用**了哪些其他模块。 |
| `backwardReferences`| `BackwardReference[]`| 反向引用列表，描述当前文件被哪些其他模块**使用**。 |

### `ForwardReference` 对象 (我依赖谁)

| 字段 (Field) | 类型 (Type) | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 依赖关系的类型 (详见下文)。 | `"function_call"` |
| `source` | `string` | 被依赖模块的原始导入路径或标识。 | `"../../api/user"` |
| `resolvedPath` | `string \| null`| 解析后的项目内绝对路径。 | `"src/api/user.js"` |
| `imported` / `function`| `string` / `string[]`| 具体依赖的函数/组件/变量名。 | `"fetchUserInfo"` |
| `context` | `string \| null`| 此依赖关系发生在哪个函数或组件的上下文中。 | `"loadUserInfo"` |
| `line` | `number` | 依赖关系在当前文件中的行号。 | `29` |
| `isExternal` | `boolean` | (可选) 是否为外部依赖 (npm包)。 | `false` |

### `BackwardReference` 对象 (谁依赖我)

| 字段 (Field) | 类型 (Type) | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `referencedBy` | `string` | 哪个文件引用了当前文件（绝对路径）。 | `"src/pages/Dashboard.jsx"` |
| `type` | `string` | 依赖关系的类型。 | `"jsx_element"` |
| `function` / `context`| `string` | 在引用文件中的哪个函数/组件内发生。 | `"Dashboard.render"` |
| `line` | `number` | 引用关系在对方文件中的行号。 | `45` |
| `usage` | `string \| null`| (可选) 具体的引用代码片段，用于快速预览。 | `"<UserProfile ... />"` |

## 4. 依赖关系类型 (`type`) 说明

`type` 字段提供了理解依赖关系性质的关键信息：

- **`import`**: 静态的模块导入，表示模块级的依赖。
- **`function_call`**: 直接的函数调用。
- **`jsx_element`**: 作为一个 React 组件在 JSX 中被使用。
- **`hoc_usage`**: 作为一个高阶组件 (HOC) 被使用。
- **`hook_call`**: 作为一个自定义 Hook 被调用。
- **`route_component`**: 在路由定义中被用作页面或布局组件。
- **`navigation`**: 在路由跳转逻辑中被引用（如 `navigate('/path')`）。

## 5. 数据收集策略

- **正向引用 (`forwardReferences`)**:
  - **来源**: 完全通过解析**当前文件**的 AST 来收集。
  - **方法**: 遍历 AST 节点，如 `ImportDeclaration`, `CallExpression`, `JSXOpeningElement` 等，提取出所有向外的调用和引用。

- **反向引用 (`backwardReferences`)**:
  - **来源**: **无法**仅通过解析当前文件获得。这是**全局分析**的结果。
  - **方法**:
    1.  **第一阶段 (Parse & Forward Link)**: 首先，解析器需要遍历**项目中的所有文件**，并为每个文件生成其 `forwardReferences`。
    2.  **第二阶段 (Index & Backward Link)**: 在所有正向引用都建立完毕后，进行一个全局的“链接”或“索引”过程。遍历所有文件的正向引用记录，反向填充到被引用文件的 `backwardReferences` 列表中。
    - **例如**: 当解析器发现 `Dashboard.jsx` 的正向引用中包含了对 `UserProfile.jsx` 的使用，它就会在 `UserProfile.jsx` 的 `backwardReferences` 中添加一条来自 `Dashboard.jsx` 的记录。

## 6. 完整示例 (Example)

```json
{
  "dependencies": {
    "forwardReferences": [
      {
        "type": "import",
        "source": "react",
        "imported": ["React", "useState", "useEffect"],
        "line": 1,
        "isExternal": true
      },
      {
        "type": "function_call",
        "function": "fetchUserInfo",
        "source": "../../api/user",
        "resolvedPath": "src/api/user.js",
        "line": 29,
        "context": "loadUserInfo",
        "isAsync": true
      }
    ],
    "backwardReferences": [
      {
        "referencedBy": "src/pages/Dashboard.jsx",
        "function": "Dashboard.render",
        "line": 45,
        "type": "jsx_element",
        "usage": "<UserProfile userId={currentUser.id} />"
      },
      {
        "referencedBy": "src/routes/AppRoutes.jsx",
        "function": "AppRoutes",
        "line": 23, 
        "type": "route_component",
        "usage": "path='/user/profile/:userId' component={UserProfile}"
      }
    ]
  }
}
```