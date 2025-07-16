# 文件元数据编码器 (`fileMetadata`)

## 1. 概述 (Overview)

`fileMetadata` 编码器是 CodeWise 解析引擎的核心组件之一。它的主要职责是从文件系统、版本控制系统（如 Git）以及代码注释中提取关于源文件的核心元数据。

这些元数据为文件提供了一个唯一的、可追溯的身份标识，是构建代码知识图谱、实现精准检索和提供完整上下文的基础。

## 2. 设计目标 (Goals)

- **身份识别**: 为每个文件提供唯一的路径、名称和所属仓库信息。
- **版本追踪**: 记录文件的版本、分支和最后修改时间，支持代码演进分析。
- **功能描述**: 通过`fileDescription`字段，提供对文件整体功能的高层次概括，优化语义搜索。
- **数据来源**: 明确每个元数据字段的来源，确保数据的准确性和可追溯性。

## 3. JSON 结构定义

`fileMetadata` 对象包含以下字段：

| 字段 (Field) | 类型 (Type) | 描述 (Description) | 示例 (Example) | 来源 (Source) |
| :--- | :--- | :--- | :--- | :--- |
| `filePath` | `string` | 文件在项目中的相对路径，作为文件的唯一标识符。 | `src/pages/user/UserProfile.jsx` | File System |
| `repositoryName`| `string` | 文件所属的代码仓库名称。 | `CodeWise-Frontend` | Git / Config |
| `fileName` | `string` | 文件的名称，包含扩展名。 | `UserProfile.jsx` | File System |
| `lastModified` | `string` | 文件的最后修改时间 (ISO 8601 格式)。 | `2024-01-15T10:30:00Z` | Git / File System |
| `version` | `string` | 文件当前所在的代码版本或 Commit Hash。 | `1.2.3` / `a1b2c3d` | Git |
| `branch` | `string` | 文件当前所在的分支名称。 | `feature/user-profile` | Git |
| `fileDescription`| `string` | 对文件整体功能的简短描述，通常从文件顶部的块注释中提取。 | `用户个人资料页面...` | AST (Top-level Comment) |

## 4. 完整示例 (Example)

```json
{
  "fileMetadata": {
    "filePath": "src/pages/user/UserProfile.jsx",
    "repositoryName": "CodeWise",
    "fileName": "UserProfile.jsx",
    "lastModified": "2024-01-15T10:30:00Z",
    "version": "1.2.3",
    "branch": "feature/user-management",
    "fileDescription": "用户个人资料页面，提供用户信息展示、编辑、头像上传等功能"
  }
}
```

## 5. 数据收集策略

- **文件系统**: `filePath`, `fileName` 可通过文件系统 API 直接获取。`lastModified` 可作为 Git 不可用时的备选方案。
- **Git**: `repositoryName`, `version`, `branch`, `lastModified` 等信息应优先从 Git 历史记录中获取，以保证准确性。例如，使用 `git log -1 --pretty=format:%H %cs -- <file_path>` 获取最新 commit 和日期。
- **AST (抽象语法树)**: `fileDescription` 通常从解析文件得到的 AST 的顶部注释 (`leadingComments`) 中提取，这要求项目有良好的注释规范。