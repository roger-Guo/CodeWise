"""
CodeWise Agent服务主程序
"""
import logging
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from config import settings
from api.routes import router
from clients.rag_client import rag_client
from clients.ollama_client import ollama_client
from core.workflow import workflow

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('agent_service.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger.info("启动CodeWise Agent服务...")
    
    try:
        # 检查RAG服务连接
        logger.info("检查RAG服务连接...")
        rag_health = await rag_client.health_check()
        if rag_health.get("status") != "healthy":
            logger.warning(f"RAG服务状态异常: {rag_health}")
        else:
            logger.info("RAG服务连接正常")
        
        # 检查Ollama服务连接
        logger.info("检查Ollama服务连接...")
        ollama_health = await ollama_client.health_check()
        if ollama_health.get("status") != "healthy":
            logger.warning(f"Ollama服务状态异常: {ollama_health}")
            if not ollama_health.get("model_available", False):
                logger.error(f"Ollama模型 {settings.llm_model_name} 不可用")
        else:
            logger.info(f"Ollama服务连接正常，模型: {settings.llm_model_name}")
        
        # 初始化工作流
        logger.info("初始化LangGraph工作流...")
        # workflow已经在导入时初始化
        logger.info("工作流初始化完成")
        
        logger.info("Agent服务启动完成")
        
    except Exception as e:
        logger.error(f"服务启动失败: {e}")
        raise RuntimeError(f"Agent服务启动失败: {e}")
    
    yield
    
    # 关闭时清理
    logger.info("关闭Agent服务...")
    try:
        await rag_client.close()
        await ollama_client.close()
        logger.info("资源清理完成")
    except Exception as e:
        logger.error(f"资源清理失败: {e}")

# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    description="CodeWise智能代码库检索与问答系统的Agent服务，基于LangGraph实现多轮代码分析",
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
app.include_router(router, prefix="/api/v1", tags=["Agent"])

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
        "api_prefix": "/api/v1",
        "workflow_visualization": "/api/v1/workflow-visualization"
    }

# 服务信息
@app.get("/info")
async def service_info():
    """服务信息端点"""
    return {
        "service_name": settings.app_name,
        "version": "1.0.0",
        "llm_model": settings.llm_model_name,
        "rag_service_url": settings.rag_service_url,
        "ollama_base_url": settings.ollama_base_url,
        "max_iterations": settings.max_iterations,
        "analysis_types": settings.analysis_types,
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