# 文件定义编码器 (`fileDefinitions`)

## 1. 概述 (Overview)

`fileDefinitions` 编码器负责从单个源文件中提取所有有意义的、可命名的代码块。这包括 **组件、函数、类、以及导出的变量** 等。

传统上，在代码中这些实体可以相互嵌套（例如，一个函数定义在另一个组件内部），这给JSON结构化带来了挑战。此编码器采用了一种**扁平化的设计理念**，既能保持数据结构的简洁，又能完整地保留代码的逻辑层级。

## 2. 设计哲学：扁平化列表 + 作用域路径

为了避免复杂的JSON嵌套结构，我们采用以下核心原则：

- **单一列表 (Single List)**: 每个文件只生成一个顶层的 `definitions` 数组。所有代码定义，无论其在源码中的嵌套深度如何，都作为此数组的一级元素存在。
- **作用域路径 (`scopePath`)**: 使用一个字符串路径来描述每个定义的逻辑归属。
    - 顶层定义的 `scopePath` 为 `null`。
    - 嵌套定义的 `scopePath` 指向其父模块的名称（或路径）。
- **顶级标记 (`isTopLevel`)**: 通过一个布尔值 `isTopLevel` 快速识别文件顶层的定义，简化查询。
- **唯一限定名 (`qualifiedName`)**: 为每个定义生成一个在整个项目中唯一的ID，便于索引和精确查找。

## 3. JSON 结构定义

### 根对象
```json
{
  "fileDefinitions": [
    // ... 一个或多个“定义对象” ...
  ]
}
```

### `Definition` 对象

| 字段 (Field) | 类型 (Type) | 描述 (Description) | 示例 (Example) |
| :--- | :--- | :--- | :--- |
| `name` | `string` | 模块的简单名称。 | `"loadUserInfo"` |
| `qualifiedName`| `string` | 全局唯一限定名，格式：`[文件名]::[作用域路径].[名称]`。 | `"UserProfile.jsx::UserProfile.loadUserInfo"` |
| `definitionType` | `string` | 定义的类型，如: `component`, `function`, `class`, `variable`。| `"function"` |
| `scopePath` | `string` \| `null` | **作用域路径**。顶层为`null`，嵌套则为父模块路径。 | `"UserProfile"` |
| `isTopLevel` | `boolean` | **是否为文件顶层定义**。 | `false` |
| `startLine` | `number` | 在文件中的起始行号。 | `16` |
| `endLine` | `number` | 在文件中的结束行号。 | `19` |
| `codeBlock` | `string` | 该模块的完整源码片段。 | `"const loadUserInfo = async () => {...}"` |
| `description`| `string` \| `null`| 从注释中提取的功能描述。 | `"加载用户数据"` |
| `exportInfo` | `object` | 导出信息，包含 `isExported` (boolean) 和 `type` (`default`\|`named`\|`null`)。 | `{"isExported": false, "type": null}` |
| `details` | `object` | 存储特定于类型的详细信息，如组件的`props`/`hooks`，函数的`params`/`returnType`等。 | `{ "isAsync": true, "params": [] }` |


## 4. 完整示例

**源文件 (`UserProfile.jsx`):**
```jsx
import React, { useState } from 'react';

// 这是一个顶层函数
export const helperFunction = () => { /* ... */ };

/**
 * 这是一个顶层组件
 */
export default function UserProfile() {
  
  // 这是一个嵌套函数
  const loadUserInfo = async () => { /* ... */ };

  return <div>...</div>;
}
```

**生成的JSON (`fileDefinitions`):**
```json
{
  "fileDefinitions": [
    {
      "name": "helperFunction",
      "qualifiedName": "UserProfile.jsx::helperFunction",
      "definitionType": "function",
      "scopePath": null,
      "isTopLevel": true,
      "startLine": 4,
      "endLine": 4,
      "description": "这是一个顶层函数",
      "exportInfo": { "isExported": true, "type": "named" },
      "details": { /* ... */ }
    },
    {
      "name": "UserProfile",
      "qualifiedName": "UserProfile.jsx::UserProfile",
      "definitionType": "component",
      "scopePath": null,
      "isTopLevel": true,
      "startLine": 9,
      "endLine": 15,
      "description": "这是一个顶层组件",
      "exportInfo": { "isExported": true, "type": "default" },
      "details": { /* ... */ }
    },
    {
      "name": "loadUserInfo",
      "qualifiedName": "UserProfile.jsx::UserProfile.loadUserInfo",
      "definitionType": "function",
      "scopePath": "UserProfile",
      "isTopLevel": false,
      "startLine": 12,
      "endLine": 12,
      "description": "这是一个嵌套函数",
      "exportInfo": { "isExported": false, "type": null },
      "details": { /* ... */ }
    }
  ]
}
```

## 5. 优势

- **结构简洁**: 无需处理复杂的JSON嵌套，数据消费方逻辑更简单。
- **关系清晰**: `scopePath` 完整地保留了模块间的逻辑归属关系。
- **查询高效**: 可以轻松地通过 `isTopLevel` 或 `scopePath` 过滤模块，而无需递归遍历。
- **扩展性强**: 即使未来出现多层嵌套，该结构也能优雅地应对。