# 路由信息编码器 (`routingInfo`)

## 1. 概述 (Overview)

`routingInfo` 编码器负责解析代码库中的路由配置，以确定一个组件是如何被映射到一个或多个可访问地址（如URL）的。它充当了连接用户入口和具体代码实现之间的桥梁。

这份数据对于理解应用的整体结构、页面流程以及特定组件的暴露面至关重要。

## 2. 设计目标 (Goals)

- **识别路由映射**: 找出将 URL 路径映射到特定 React 组件的路由规则。
- **支持多平台**: 能够解析和表示不同平台（H5、小程序、App）的路由方案。
- **提取动态参数**: 识别路径中的动态部分（如 `:userId`），并将其结构化。
- **关联路由定义**: 记录路由规则本身是在哪个文件中定义的，便于溯源。
- **区分路由类型**: 识别页面路由、布局路由、索引路由等不同角色。

## 3. JSON 结构定义

### `routingInfo` 对象

**注意**: 此对象应被添加到**被渲染组件**的最终JSON输出中，而不是定义路由的文件中。它描述的是“当前组件”作为路由目标的访问方式。

| 字段 (Field) | 类型 (Type) | 描述 |
| :--- | :--- | :--- |
| `routes` | `Route[]` | 一个数组，包含所有指向当前组件的路由规则。一个组件可能被多个路由使用。 |

### `Route` 对象

| 字段 (Field) | 类型 (Type) | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 目标平台: `h5`, `miniprogram`, `app`。 | `"h5"` |
| `path` | `string` | 路由的路径模式。 | `"/user/profile/:userId"` |
| `parameters` | `object[]` | 从路径中提取的动态参数列表。 | `[{ name: "userId", type: "string" }]`|

## 4. 数据收集策略

路由信息的提取是一个**全局分析**过程，因为它通常涉及专门的路由配置文件，而不是组件文件本身。

1.  **识别路由配置**: 解析器需要被配置或通过启发式方法（如文件名匹配 `*router.jsx`, `*routes.js`, `App.jsx`）来找到项目中的路由定义文件。
2.  **解析路由定义**:
    -   **声明式 (React Router)**: 遍历 AST，查找 `Route` 组件 (`<Route path="..." element={<UserProfile />} />`) 或使用 `createBrowserRouter` 创建的路由对象数组 (`{ path: "...", element: <UserProfile /> }`)。
    -   **文件系统路由 (Next.js)**: 根据文件在特定目录（如 `pages` 或 `app`）下的路径来生成路由信息。例如 `pages/user/[id].jsx` 自动映射到 `/user/:id`。
3.  **信息关联**:
    -   当解析器在路由配置中找到一条规则，如 `path="/user/:userId"` 渲染了 `<UserProfile />` 组件时。
    -   它需要将这条路由信息（路径、参数等）提取出来。
    -   然后，将这个 `Route` 对象添加到 `UserProfile.jsx` 文件最终生成的JSON中的 `routingInfo.routes` 数组里。

## 5. 完整示例 (Example)

假设在 `src/router.jsx` 中有如下定义:
```jsx
// src/router.jsx
createBrowserRouter([
  {
    path: "/user/profile/:userId",
    element: <UserProfile />,
  }
]);
```

那么，在为 `src/components/UserProfile.jsx` 文件生成的JSON中，`routingInfo` 部分会是：

```json
{
  "routingInfo": {
    "routes": [
      {
        "platform": "h5",
        "path": "/user/profile/:userId",
        "isIndex": false,
        "isLayout": false,
        "parameters": [
          { "name": "userId", "type": "string" }
        ],
        "fullUrlPattern": "https://your-app.com/user/profile/:userId",
        "definitionFile": "src/router.jsx",
        "definitionLine": 4
      }
    ]
  }
}
```