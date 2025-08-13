"""
CodeWise RAG服务主程序
"""
import logging
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from config import settings
from api.routes import router
from models.embedding_model import embedding_model
from database.chroma_client import chroma_client

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('rag_service.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger.info("启动CodeWise RAG服务...")
    
    try:
        # 初始化嵌入模型
        logger.info("加载嵌入模型...")
        embedding_model.load_model()
        logger.info("嵌入模型加载完成")
        
        # 初始化数据库连接
        logger.info("初始化数据库连接...")
        chroma_client.initialize()
        logger.info("数据库连接初始化完成")
        
        logger.info("RAG服务启动完成")
        
    except Exception as e:
        logger.error(f"服务启动失败: {e}")
        raise RuntimeError(f"RAG服务启动失败: {e}")
    
    yield
    
    # 关闭时清理
    logger.info("关闭RAG服务...")

# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    description="CodeWise智能代码库检索与问答系统的RAG服务",
    version="1.0.0",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该限制来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(router, prefix="/api/v1", tags=["RAG"])

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    logger.error(f"未处理的异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "服务内部错误",
            "detail": str(exc) if settings.debug else "请联系系统管理员"
        }
    )

# 根路径
@app.get("/")
async def root():
    """根路径信息"""
    return {
        "service": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
        "api_prefix": "/api/v1"
    }

# 服务信息
@app.get("/info")
async def service_info():
    """服务信息端点"""
    return {
        "service_name": settings.app_name,
        "version": "1.0.0",
        "embedding_model": settings.embedding_model_name,
        "database": "ChromaDB",
        "parser_output_dir": str(settings.parser_output_dir),
        "chroma_db_path": str(settings.chroma_db_path),
        "debug_mode": settings.debug
    }

if __name__ == "__main__":
    # 运行服务
    logger.info(f"启动{settings.app_name}...")
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )