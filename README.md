# CodeWise 

## 智能代码库检索与问答Agent

本地中文大语言模型 deepseek-coder-v2
向量数据库 chroma_db
中文嵌入模型 BAAI/bge-m3
RAG 编排框架 LlamaIndex
代码解析器 @babel,@vue/compiler-sfc,@vue/compiler-dom
python版本 3.13.5
python包管理器 miniconda
miniconda虚拟环境 codewise
nodejs版本 20.19.3

CodeWise/
├── frontend/          # Vue 3 前端 + vite + Ant Design Vue
├── ast/               # 将源码编译成可分块文件的脚本
├── backend/           # Python FastAPI 后端
├── models/            # 本地嵌入模型存储 
├── db/                # 向量数据库 chroma_db
├── data/              # 文档 需要处理的代码文件源文件以及代码处理后的JSON文件
└── scripts/           # 部署脚本