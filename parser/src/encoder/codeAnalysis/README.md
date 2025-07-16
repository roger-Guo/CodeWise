# 依赖关系编码器 (`dependencyInfo`)

## 1. 概述 (Overview)

`dependencyInfo` 编码器专注于分析源文件的模块依赖关系。它通过解析 `import` 和 `export` 语句，精确地描绘出文件在整个项目代码图谱中的“输入”和“输出”。

这份数据是构建项目级依赖关系图、进行影响分析和理解模块间耦合关系的核心依据。

## 2. 设计目标 (Goals)

- **识别外部依赖 (`imports`)**: 清晰地列出文件运行所需要的所有外部模块。
- **声明公开接口 (`exports`)**: 明确文件向项目其他部分暴露了哪些函数、组件或变量。
- **支持路径解析**: 将相对导入路径 (`../utils`) 解析为项目内的绝对路径 (`src/utils/index.js`)。
- **处理复杂场景**: 支持重命名导入 (`import { a as b }`)、命名空间导入 (`import * as a`) 和转发出（`export * from '...'`）。

## 3. JSON 结构定义

### `dependencyInfo` 对象

| 字段 (Field) | 类型 (Type) | 描述 |
| :--- | :--- | :--- |
| `imports` | `Import[]` | 文件中所有导入语句的结构化列表。 |
| `exports` | `Export[]` | 文件中所有导出语句的结构化列表。 |

### `Import` 对象

| 字段 (Field) | 类型 (Type) | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `source` | `string` | 导入的来源模块路径。 | `'react'`, `'../../api/user'` |
| `type` | `string` | 依赖类型: `internal` (项目内) 或 `external` (npm包)。 | `'internal'` |
| `resolvedPath` | `string \| null`| `internal` 依赖解析后的项目绝对路径。 | `src/api/user.js` |
| `specifiers` | `Specifier[]` | 导入的具体说明符列表。 | `[...]` |
| `line` | `number` | `import` 语句所在的行号。 | `5` |

### `Export` 对象

| 字段 (Field) | 类型 (Type) | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 导出类型: `default`, `named`, `all`。 | `'default'` |
| `source` | `string \| null`| 转发出（re-export）的来源，否则为 `null`。 | `'./utils'` |
| `specifiers` | `Specifier[]` | 导出的具体说明符列表。 | `[...]` |
| `line` | `number` | `export` 语句所在的行号。 | `119` |

### `Specifier` 对象 (用于 `imports` 和 `exports`)

| 字段 (Field) | 类型 (Type) | 描述 | 示例 (Import) | 示例 (Export) |
| :--- | :--- | :--- | :--- | :--- |
| `type` | `string` | 说明符类型: `default`, `named`, `namespace`。 | `'named'` | `'default'` |
| `imported` | `string` | **被导入**的原始名称。 | `'useState'` | - |
| `local` | `string` | 在**当前文件**中的本地名称。 | `'useState'` | `'UserProfile'` |
| `exported` | `string` | **被导出**的名称。 | - | `'default'` |

## 4. 完整示例 (Example)

```json
{
  "dependencyInfo": {
    "imports": [
      {
        "source": "react",
        "type": "external",
        "resolvedPath": null,
        "specifiers": [
          { "type": "default", "imported": "React", "local": "React" },
          { "type": "named", "imported": "useState", "local": "useState" }
        ],
        "line": 1
      },
      {
        "source": "../../api/user",
        "type": "internal",
        "resolvedPath": "src/api/user.js",
        "specifiers": [
          { "type": "named", "imported": "fetchUserInfo", "local": "fetchUserInfo" }
        ],
        "line": 5
      }
    ],
    "exports": [
      {
        "type": "named",
        "source": "./utils",
        "specifiers": [
          { "local": "helperFunction", "exported": "helperFunction" }
        ],
        "line": 8
      },
      {
        "type": "default",
        "source": null,
        "specifiers": [
          { "local": "UserProfile", "exported": "default" }
        ],
        "line": 119
      }
    ]
  }
}
```

## 5. 数据收集策略

- **AST 遍历**: 通过遍历 AST 中的 `ImportDeclaration`, `ExportNamedDeclaration`, `ExportDefaultDeclaration`, `ExportAllDeclaration` 节点来收集所有依赖信息。
- **路径解析**: 需要一个路径解析器（如 Node.js 的 `resolve` 模块或自定义实现），结合项目的别名配置（如 `tsconfig.json`, `webpack.config.js`）来计算 `resolvedPath`。
- **外部依赖判断**: 通常可以通过检查 `source` 路径是否为相对路径（以 `.` 或 `/` 开头）来区分 `internal` 和 `external` 依赖。