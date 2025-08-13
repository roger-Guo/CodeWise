# CodeWise RAG服务

基于FastAPI的RAG（Retrieval-Augmented Generation）服务，集成BAAI/bge-m3嵌入模型和ChromaDB向量数据库，为CodeWise代码知识图谱提供智能检索能力。

## 🚀 快速启动

### 1. 环境准备

```bash
# 激活codewise虚拟环境
conda activate codewise

# 安装依赖
cd rag
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 使用启动脚本（推荐）
python start.py

# 或直接运行
python main.py
```

### 3. 访问服务

- **API文档**: http://127.0.0.1:8000/docs
- **服务信息**: http://127.0.0.1:8000/info  
- **健康检查**: http://127.0.0.1:8000/api/v1/health

## 📋 核心功能

### 🔍 智能代码搜索
- 基于BAAI/bge-m3的语义向量搜索
- 支持中文代码注释和文档检索
- 相似度分数和结果排序

### 📊 数据管理
- 自动加载parser解析结果
- 支持增量和全量数据更新
- 实时数据库统计信息

### 🗃️ 向量存储
- ChromaDB持久化存储
- 高效的向量相似度计算
- 灵活的元数据过滤

## 🛠️ API端点

### 搜索相关

**POST** `/api/v1/search` - 代码搜索
```json
{
  "query": "React组件状态管理",
  "top_k": 10,
  "filter_metadata": {"file_type": "jsx"},
  "include_content": true
}
```

**GET** `/api/v1/document/{doc_id}` - 获取特定文档

### 数据管理

**POST** `/api/v1/load-data` - 加载解析器数据
```json
{
  "reload": false,
  "batch_size": 10
}
```

**GET** `/api/v1/stats` - 数据库统计信息

**DELETE** `/api/v1/reset` - 重置数据库

### 服务管理

**POST** `/api/v1/initialize` - 初始化服务

**GET** `/api/v1/health` - 健康检查

## 📁 目录结构

```
rag/
├── api/                    # API层
│   ├── models.py          # 数据模型
│   └── routes.py          # 路由定义
├── database/              # 数据库层  
│   └── chroma_client.py   # ChromaDB客户端
├── data_loader/           # 数据加载层
│   └── parser_loader.py   # 解析器数据加载器
├── models/                # 模型层
│   └── embedding_model.py # 嵌入模型封装
├── config.py              # 配置管理
├── main.py                # 主程序
├── start.py               # 启动脚本
├── requirements.txt       # 依赖列表
└── README.md              # 说明文档
```

## ⚙️ 配置说明

### 环境变量

复制 `.env.example` 到 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

### 主要配置项

- **嵌入模型**: BAAI/bge-m3，支持中文优化
- **向量维度**: 1024维
- **数据库**: ChromaDB持久化存储
- **批处理**: 默认32个文档/批次

## 🔧 使用示例

### 1. 初始化服务

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/initialize"
```

### 2. 加载数据

```bash
# 加载解析器输出数据
curl -X POST "http://127.0.0.1:8000/api/v1/load-data" \
  -H "Content-Type: application/json" \
  -d '{"reload": false, "batch_size": 10}'
```

### 3. 搜索代码

```bash
# 搜索React组件
curl -X POST "http://127.0.0.1:8000/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "useState Hook的使用",
    "top_k": 5,
    "include_content": true
  }'
```

### 4. 查看统计

```bash
curl "http://127.0.0.1:8000/api/v1/stats"
```

## 🔍 数据处理流程

### 1. 数据发现
- 扫描 `parser/output/` 目录
- 识别所有JSON文件（除project-summary.json）

### 2. 内容提取
- **文件级别**: 提取文件摘要、依赖关系
- **定义级别**: 提取组件、函数、类的详细信息

### 3. 向量化
- 使用BAAI/bge-m3模型生成嵌入向量
- 优化中文代码注释处理

### 4. 存储
- ChromaDB向量存储
- 保留完整元数据信息

## 🚨 故障排除

### 环境问题
```bash
# 检查conda环境
conda info --envs

# 激活环境
conda activate codewise

# 检查Python包
pip list | grep -E "(fastapi|chromadb|torch)"
```

### 模型加载问题
```bash
# 检查模型文件
ls -la ../models/

# 查看服务日志
tail -f rag_service.log
```

### 数据库问题
```bash
# 检查数据库目录
ls -la ../db/

# 重置数据库
curl -X DELETE "http://127.0.0.1:8000/api/v1/reset"
```

## 📊 性能优化

### 批处理优化
- 调整 `batch_size` 参数
- 监控内存使用情况

### 向量搜索优化
- 设置合适的 `top_k` 值
- 使用元数据过滤减少搜索范围

### 模型优化
- 根据硬件选择设备（CPU/GPU/MPS）
- 调整 `max_seq_length` 参数

## 🔗 相关服务

- **Parser**: 代码解析和知识图谱构建
- **Agent**: LangGraph智能代理服务
- **Frontend**: React前端界面

## 📝 开发注意事项

1. **环境管理**: 始终在 `codewise` 虚拟环境中开发
2. **中文支持**: 所有日志和错误信息使用中文
3. **异步处理**: 数据加载使用异步操作提升性能
4. **错误处理**: 完善的异常处理和日志记录
5. **资源管理**: 及时清理模型和数据库连接