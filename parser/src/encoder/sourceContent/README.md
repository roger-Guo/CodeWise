# 源码内容编码器 (`sourceContent`)

## 1. 概述 (Overview)

`sourceContent` 编码器负责从源文件中提取两个核心内容：**完整的原始内容**和**结构化的注释信息**。

这部分数据是 CodeWise 进行深度代码分析的“养料”，也是向 RAG 系统提供精确、完整上下文的基石。保留原始内容可以确保分析的准确性，而提取注释则是保留了代码中宝贵的人类智慧和意图。

## 2. 设计目标 (Goals)

- **上下文完整性**: 为 RAG 和开发者提供未经修改的源代码，便于理解、调试和生成代码片段。
- **保留人类知识**: 结构化地提取所有代码注释，这些注释是理解代码设计意图、业务逻辑和历史背景的关键。
- **可追溯性**: 通过位置信息，将注释与具体的代码上下文关联起来。
- **性能意识**: 考虑到大文件对存储和内存的消耗，提供灵活的内容存储策略。

## 3. JSON 结构定义

### `sourceContent` 对象

| 字段 (Field) | 类型 (Type) | 描述 (Description) | 示例 (Example) | 来源 (Source) |
| :--- | :--- | :--- | :--- | :--- |
| `originalContent`| `string` | 文件的完整原始内容。对于大文件，建议采用分离存储策略（见“性能考量”）。 | `"import React..."` | File System |
| `startLine` | `number` | 文件内容的起始行号，固定为 `1`。 | `1` | File System |
| `endLine` | `number` | 文件内容的结束行号，即文件的总行数。 | `119` | File System |
| `comments` | `Comment[]` | 从文件中提取出的所有注释的结构化列表。 | `[...]` | AST |

### `Comment` 对象

| 字段 (Field) | 类型 (Type) | 描述 (Description) | 示例 (Example) |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 注释类型，`block` (块注释 `/* */`) 或 `line` (行注释 `//`)。 | `"block"` |
| `content` | `string` | 注释的文本内容（已去除注释符号）。 | `"用户信息状态"` |
| `startLine` | `number` | 注释开始的行号。 | `19` |
| `endLine` | `number` | 注释结束的行号（对于单行注释，与 `startLine` 相同）。 | `19` |
| `associatedWith`| `string` | (可选) 与此注释最相关的代码元素名称（如函数名、变量名），用于增强上下文关联。 | `"UserProfile"` |

## 4. 完整示例 (Example)

```json
{
  "sourceContent": {
    "originalContent": "import React, { useState } from 'react';\n\n/**\n * 一个简单的计数器组件\n */\nconst Counter = () => {\n  // 计数状态\n  const [count, setCount] = useState(0);\n\n  return <button onClick={() => setCount(count + 1)}>{count}</button>;\n};",
    "startLine": 1,
    "endLine": 10,
    "comments": [
      {
        "type": "block",
        "content": "一个简单的计数器组件",
        "startLine": 3,
        "endLine": 5,
        "associatedWith": "Counter"
      },
      {
        "type": "line",
        "content": "计数状态",
        "startLine": 7,
        "endLine": 7,
        "associatedWith": "useState"
      }
    ]
  }
}
```

## 5. 数据收集策略

- **原始内容**: `originalContent`, `startLine`, `endLine` 通过标准的文件系统 API 读取。
- **注释信息**: `comments` 数组通过 AST 解析器（如 Babel, SWC）在解析代码时提取。这通常需要在解析器配置中显式启用 `comments: true` 或类似选项。
- **注释关联 (`associatedWith`)**: 此字段需要额外的启发式逻辑来推断。一种常见方法是检查注释在 AST 中的位置（如 `leadingComments`, `trailingComments`, `innerComments`）与相邻AST节点的关系来确定其归属。

## 6. 性能考量 (Performance Considerations)

在JSON中直接存储所有文件的 `originalContent` 可能会消耗大量内存和磁盘空间，尤其是在处理大型代码库时。强烈建议采用**内容分离**的优化策略：

- **哈希与预览**: 在JSON中只存储文件内容的哈希值和前N行（如100行）作为快速预览。
- **独立存储**: 将完整的 `originalContent` 存储在外部存储系统（如对象存储、独立文件）中，通过哈希值或唯一路径进行关联。当需要完整内容时，再按需加载。

```json
// 优化的 sourceContent 结构
{
  "sourceContent": {
    "contentHash": "sha256:a1b2c3d4...", 
    "storagePath": "/path/to/content_store/a1b2c3d4.txt",
    "sizeInBytes": 12345,
    "preview": "import React, { useState } from 'react';\n...",
    "startLine": 1,
    "endLine": 119,
    "comments": [...]
  }
}
```
