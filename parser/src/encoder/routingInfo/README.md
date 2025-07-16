路由信息
  g. 在项目中的路由地址 h5地址 小程序地址 app地址
  h. (页面/组件/模块)名称
  i. (页面/组件/模块)的功能描述

{
   "routingInfo": {
     "name": '',
     "description" : "",
    "routes": [
      {
        "platform": "h5",
        "path": "/user/profile/:userId",
        "fullUrl": "https://app.codewise.com/user/profile/:userId",
        "method": "GET"
      },
      {
        "platform": "miniprogram",
        "path": "/pages/user/profile",
        "query": "?userId={{userId}}",
        "fullUrl": "pages/user/profile?userId={{userId}}"
      },
      {
        "platform": "app",
        "scheme": "codewise://user/profile",
        "params": "?userId={{userId}}"
      }
    ],
    
  }
}