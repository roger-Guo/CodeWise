import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 移除预加载的loading元素
const loadingElement = document.querySelector('.loading')
if (loadingElement) {
  loadingElement.remove()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)