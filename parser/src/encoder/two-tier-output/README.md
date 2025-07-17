# 两级分离式输出架构 (Two-Tier Separated Output)

## 1. 概述 (Overview)

CodeWise 解析器采用**两级分离式输出架构**，将每个源文件的所有定义（类、函数、组件、导出变量）按照**作用域层级**分类，并为每个定义生成独立的JSON文件。这种设计实现了**精细化的知识图谱节点管理**，每个代码实体都是独立的知识图谱节点。

## 2. 设计理念

### 两级结构划分
- **顶层定义 (Top-Level Definitions)**: 文件作用域直接定义的实体
- **嵌套定义 (Nested Definitions)**: 在其他函数、组件或类内部定义的实体

### 分离式输出优势
1. **独立节点管理**: 每个定义都是独立的知识图谱节点，便于索引和检索
2. **精细化分析**: 可以对单个函数或组件进行深度分析，而不需要加载整个文件
3. **影响范围追踪**: 通过依赖关系图谱，精确分析代码修改的影响范围
4. **并行处理**: 支持对不同定义的并行分析和处理
5. **存储优化**: 只加载需要的定义，减少内存占用

## 3. 目录结构

```
output/
└── [文件名]/
    ├── top-level/           # 顶层定义
    │   ├── [名称]_component.json
    │   ├── [名称]_function.json
    │   ├── [名称]_class.json
    │   └── [名称]_variable.json
    └── nested/              # 嵌套定义
        ├── [作用域]_[名称]_component.json
        ├── [作用域]_[名称]_function.json
        ├── [作用域]_[名称]_class.json
        └── [作用域]_[名称]_variable.json
```

### 实际示例
```
output/
└── FunctionComponent/
    ├── top-level/
    │   ├── UserProfile_component.json      # 顶层组件
    │   ├── sayHi_function.json            # 顶层导出函数
    │   └── CONFIG_variable.json           # 顶层导出变量
    └── nested/
        ├── UserProfile_handleClick_function.json  # 组件内嵌套函数
        ├── UserProfile_LoadingState_component.json # 组件内嵌套组件
        └── UserProfile_useUserData_function.json   # 组件内自定义Hook
```

## 4. JSON 文件格式

每个定义的JSON文件都包含以下统一结构：

```json
{
  "fileMetadata": {
    "filePath": "源文件路径",
    "fileName": "文件名",
    "fileType": "javascript|typescript",
    "isJSX": true,
    "totalLines": 38,
    "repositoryName": "CodeWise",
    "version": "Git版本号",
    "branch": "Git分支名"
  },
  "definitionInfo": {
    "name": "定义名称",
    "qualifiedName": "文件名::作用域路径.名称",
    "definitionType": "component|function|class|variable",
    "scopePath": "作用域路径|null",
    "isTopLevel": true,
    "startLine": 11,
    "endLine": 32,
    "codeBlock": "完整源代码",
    "description": "从注释提取的描述",
    "exportInfo": {
      "isExported": true,
      "type": "default|named|null"
    }
  },
  "dependencyInfo": {
    "forwardReferences": [
      {
        "type": "import|function_call|jsx_element",
        "source": "依赖来源",
        "imported": "导入名称",
        "resolvedPath": "解析后路径",
        "line": 5
      }
    ],
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
  },
  "details": {
    // 特定类型的详细信息
    // 组件: componentType, jsx
    // 函数: isAsync, params, returnType, calls
    // 类: superClass, methods, properties
    // 变量: variableType, initialValue, isFunction
  }
}
```

## 5. 定义类型分类

### 组件 (Components)
- **函数组件**: React函数组件
- **类组件**: React.Component子类
- **高阶组件**: 返回组件的函数

### 函数 (Functions)
- **普通函数**: function声明
- **箭头函数**: () => {} 形式
- **异步函数**: async函数
- **自定义Hook**: use开头的函数

### 类 (Classes)
- **React组件类**: 继承自React.Component
- **普通类**: 其他类定义
- **抽象类**: abstract类（TypeScript）

### 变量 (Variables)
- **导出常量**: export const
- **配置对象**: 配置相关的变量
- **函数变量**: 赋值为函数的变量

## 6. 作用域路径 (Scope Path)

作用域路径用于标识嵌套定义的归属关系：

| 定义位置 | scopePath | 示例 |
|---------|-----------|------|
| 文件顶层 | `null` | `UserProfile_component.json` |
| 组件内函数 | `"UserProfile"` | `UserProfile_handleClick_function.json` |
| 函数内函数 | `"UserProfile.handleClick"` | `UserProfile_handleClick_validateInput_function.json` |
| 类方法内函数 | `"UserClass.method"` | `UserClass_method_helper_function.json` |

## 7. 应用场景

### 精确的代码分析
```javascript
// 查询特定函数的所有信息
const handleClickInfo = loadDefinition('FunctionComponent/nested/UserProfile_handleClick_function.json')

// 分析函数的依赖关系
const dependencies = handleClickInfo.dependencyInfo.forwardReferences

// 查找调用此函数的地方
const callers = handleClickInfo.dependencyInfo.backwardReferences
```

### 影响范围分析
```javascript
// 当修改 sayHello 函数时，找到所有受影响的定义
const affectedDefinitions = findBackwardReferences('sayHello')

// 分析修改传播路径
const impactChain = buildImpactChain('sayHello', affectedDefinitions)
```

### 组件内部结构分析
```javascript
// 查找 UserProfile 组件的所有内部定义
const nestedDefinitions = loadNestedDefinitions('UserProfile')

// 分析组件的复杂度
const complexity = analyzeComponentComplexity(nestedDefinitions)
```

## 8. 与 LangGraph Agent 集成

### 智能检索流程
1. **入口检索**: 根据用户问题检索相关的顶层定义
2. **依赖扩展**: 通过 forwardReferences 扩展相关定义
3. **上下文聚合**: 聚合所有相关定义的完整上下文
4. **智能回答**: 基于完整上下文生成准确答案

### 状态管理
- **访问栈**: 记录已访问的定义，避免循环
- **上下文缓存**: 缓存已加载的定义信息
- **依赖图**: 动态构建完整的依赖关系图

## 9. 性能优化

### 懒加载策略
- 只在需要时加载特定定义的JSON文件
- 支持批量加载相关定义
- 缓存频繁访问的定义信息

### 并行处理
- 可以并行分析多个独立的定义
- 支持分布式处理大型项目
- 异步加载依赖链上的定义

### 存储优化
- 每个JSON文件包含完整的元数据，无需额外查询
- 通过哈希值检测代码变更，支持增量更新
- 压缩存储重复的元数据信息

---

这种两级分离式输出架构为 CodeWise 项目提供了**精细化、可扩展、高性能**的代码知识图谱基础设施，使得AI Agent能够更好地理解和分析代码库的内部结构和依赖关系。 