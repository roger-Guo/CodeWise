# CodeWise 解析器使用指南

## 🚀 快速开始

### 1. 安装依赖
```bash
cd parser
npm install
```

### 2. 基本使用

#### 解析单个文件
```bash
# 使用测试脚本解析单个文件
node test.js
```

#### 批量解析项目文件夹
```bash
# 使用CLI工具解析整个项目
node project-parser.js

# 解析指定目录
node project-parser.js ./src

# 指定输出目录
node project-parser.js -o ./results

# 自定义文件匹配模式
node project-parser.js --pattern "src/**/*.{jsx,tsx}"
```

## 📁 输出结构

解析完成后，会在输出目录生成以下结构：

```
output/
├── project-summary.json          # 项目汇总信息
├── FunctionComponent/
│   ├── FunctionComponent.json    # 完整文件信息
│   ├── top-level/               # 顶层定义
│   │   ├── UserProfile_component.json
│   │   ├── sayHi_function.json
│   │   └── CONFIG_variable.json
│   └── nested/                  # 嵌套定义
│       └── UserProfile_handleClick_function.json
├── ClassComponent/
│   ├── ClassComponent.json
│   ├── top-level/
│   │   ├── UserManagement_component.json
│   │   └── sayHello_function.json
│   └── nested/
└── utils/
    ├── utils.json
    ├── top-level/
    │   └── sayGoodbye_function.json
    └── nested/
```

## 📊 输出文件格式

### 项目汇总文件 (project-summary.json)
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

### 单个定义文件 (UserProfile_component.json)
```json
{
  "fileMetadata": {
    "filePath": "test-files/FunctionComponent.jsx",
    "fileName": "FunctionComponent.jsx",
    "fileType": "javascript",
    "isJSX": true,
    "totalLines": 38,
    "repositoryName": "CodeWise",
    "version": "current",
    "branch": "main"
  },
  "definitionInfo": {
    "comments": [],
    "name": "UserProfile",
    "qualifiedName": "FunctionComponent.jsx::UserProfile",
    "definitionType": "component",
    "scopePath": null,
    "isTopLevel": true,
    "startLine": 11,
    "endLine": 32,
    "codeBlock": "function UserProfile({ username, email }) { ... }",
    "description": null,
    "exportInfo": {
      "isExported": false,
      "type": null
    }
  },
  "dependencyInfo": {
    "forwardReferences": [],
    "backwardReferences": [],
    "usedImports": [
      {
        "source": "react",
        "imported": "useState",
        "local": "useState",
        "type": "named",
        "importLine": 1
      }
    ]
  }
}
```

## 🔧 命令行选项

### project-parser.js 选项

| 选项 | 简写 | 描述 | 默认值 |
|------|------|------|--------|
| `--project` | `-p` | 指定项目路径 | `./test-files` |
| `--output` | `-o` | 指定输出目录 | `./output` |
| `--pattern` | - | 文件匹配模式 | `**/*.{jsx,tsx,js,ts}` |
| `--help` | `-h` | 显示帮助信息 | - |

### 使用示例

```bash
# 解析当前目录下的所有JS/TS文件
node project-parser.js .

# 解析src目录下的React文件
node project-parser.js ./src

# 解析并输出到results目录
node project-parser.js -o ./results

# 只解析JSX和TSX文件
node project-parser.js --pattern "**/*.{jsx,tsx}"

# 解析特定目录下的所有文件
node project-parser.js ./my-project -o ./analysis-results
```

## 📋 支持的文件类型

- **JSX文件**: `.jsx`
- **TSX文件**: `.tsx` 
- **JavaScript文件**: `.js`
- **TypeScript文件**: `.ts`

## 🎯 解析内容

解析器会提取以下信息：

### 文件级别
- 文件元数据（路径、类型、行数等）
- 导入语句
- 导出语句
- 注释信息

### 定义级别
- **组件**: React函数组件、类组件
- **函数**: 普通函数、箭头函数、异步函数
- **类**: 类定义、类方法
- **变量**: 导出变量、常量

### 依赖关系
- 前向引用（该定义依赖的其他模块）
- 后向引用（依赖该定义的其他模块）
- 使用的导入模块

## 🔍 故障排除

### 常见问题

1. **文件解析失败**
   - 检查文件语法是否正确
   - 确保文件编码为UTF-8
   - 查看错误日志获取详细信息

2. **输出目录不存在**
   - 程序会自动创建输出目录
   - 确保有写入权限

3. **找不到文件**
   - 检查项目路径是否正确
   - 确认文件匹配模式是否合适

### 调试模式

```bash
# 查看详细日志
DEBUG=* node project-parser.js

# 只解析一个文件进行测试
node project-parser.js --pattern "**/FunctionComponent.jsx"
```

## 📚 相关文档

- [两级分离式输出架构](./src/encoder/two-tier-output/README.md)
- [文件定义编码器](./src/encoder/componentInfo/README.md)
- [依赖关系编码器](./src/encoder/dependencies/README.md) 