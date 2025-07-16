依赖关系
  j. 正向引用
  k. 反向引用

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
        "type": "import",
        "source": "../../api/user",
        "imported": ["fetchUserInfo", "updateUserProfile", "uploadAvatar"],
        "line": 5,
        "isExternal": false,
        "resolvedPath": "src/api/user.js"
      },
      {
        "type": "import",
        "source": "../../utils/validation", 
        "imported": ["validateEmail", "validatePhone"],
        "line": 6,
        "isExternal": false,
        "resolvedPath": "src/utils/validation.js"
      },
      {
        "type": "function_call",
        "function": "fetchUserInfo",
        "line": 29,
        "context": "loadUserInfo",
        "isAsync": true
      },
      {
        "type": "function_call",
        "function": "validateEmail",
        "line": 78,
        "context": "Form.Item.rules",
        "isAsync": false
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
      },
      {
        "referencedBy": "src/components/UserCard.jsx",
        "function": "UserCard.handleClick",
        "line": 18,
        "type": "navigation",
        "usage": "navigate('/user/profile/' + user.id)"
      }
    ]
  },
}