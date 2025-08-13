"""
API路由定义
"""
import time
import logging
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from config import settings
from database.chroma_client import chroma_client
from data_loader.parser_loader import parser_loader
from models.embedding_model import embedding_model
from .models import (
    SearchRequest, SearchResponse, SearchResult,
    LoadDataRequest, LoadDataResponse,
    DatabaseStats, DocumentRequest, DocumentResponse,
    HealthCheckResponse, ErrorResponse
)

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """健康检查端点"""
    try:
        # 检查嵌入模型状态
        embedding_status = "ready" if embedding_model.model is not None else "not_loaded"
        
        # 检查数据库状态
        try:
            db_stats = chroma_client.get_collection_stats()
            db_status = "connected" if "error" not in db_stats else "error"
        except Exception:
            db_status = "disconnected"
        
        return HealthCheckResponse(
            status="healthy",
            version="1.0.0",
            embedding_model=f"{settings.embedding_model_name} ({embedding_status})",
            database=f"ChromaDB ({db_status})",
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"服务健康检查失败: {str(e)}"
        )

@router.post("/search", response_model=SearchResponse)
async def search_code(request: SearchRequest):
    """代码搜索端点"""
    start_time = time.time()
    
    try:
        logger.info(f"收到搜索请求: {request.query[:100]}...")
        
        # 执行向量搜索
        search_results = chroma_client.search(
            query=request.query,
            top_k=request.top_k,
            where=request.filter_metadata,
            include=["documents", "metadatas", "distances"] if request.include_content else ["metadatas", "distances"]
        )
        
        if "error" in search_results:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"搜索执行失败: {search_results['error']}"
            )
        
        # 转换搜索结果
        results = []
        raw_results = search_results["results"]
        
        for i in range(len(raw_results["ids"])):
            # 计算相似度分数（距离转换为相似度）
            distance = raw_results["distances"][i] if "distances" in raw_results else 0.0
            similarity_score = max(0.0, 1.0 - distance)  # 距离越小，相似度越高
            
            result = SearchResult(
                id=raw_results["ids"][i],
                content=raw_results["documents"][i] if "documents" in raw_results else None,
                metadata=raw_results["metadatas"][i],
                similarity_score=similarity_score
            )
            results.append(result)
        
        execution_time = time.time() - start_time
        
        response = SearchResponse(
            query=request.query,
            results=results,
            total=len(results),
            execution_time=execution_time
        )
        
        logger.info(f"搜索完成，返回 {len(results)} 个结果，耗时 {execution_time:.2f}s")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"搜索请求处理失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"搜索请求处理失败: {str(e)}"
        )

@router.post("/load-data", response_model=LoadDataResponse)
async def load_parser_data(request: LoadDataRequest):
    """加载解析器数据端点"""
    start_time = time.time()
    
    try:
        logger.info(f"开始加载数据，reload={request.reload}, batch_size={request.batch_size}")
        
        # 根据请求决定加载方式
        if request.reload:
            load_results = await parser_loader.reload_data()
            message = "数据重新加载完成"
        else:
            load_results = await parser_loader.load_all_files(batch_size=request.batch_size)
            message = "数据加载完成"
        
        execution_time = time.time() - start_time
        
        response = LoadDataResponse(
            success=True,
            total_files=load_results["total_files"],
            loaded_files=load_results["loaded_files"],
            failed_files=load_results["failed_files"],
            total_entries=load_results["total_entries"],
            execution_time=execution_time,
            message=message
        )
        
        logger.info(f"数据加载完成: {load_results}, 耗时 {execution_time:.2f}s")
        return response
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"数据加载失败: {e}")
        
        return LoadDataResponse(
            success=False,
            total_files=0,
            loaded_files=0,
            failed_files=0,
            total_entries=0,
            execution_time=execution_time,
            message=f"数据加载失败: {str(e)}"
        )

@router.get("/stats", response_model=DatabaseStats)
async def get_database_stats():
    """获取数据库统计信息"""
    try:
        stats = chroma_client.get_collection_stats()
        
        if "error" in stats:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"无法获取数据库统计信息: {stats['error']}"
            )
        
        return DatabaseStats(
            collection_name=stats["name"],
            document_count=stats["count"],
            embedding_model=settings.embedding_model_name,
            metadata=stats.get("metadata", {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取统计信息失败: {str(e)}"
        )

@router.get("/document/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str):
    """根据ID获取文档"""
    try:
        document = chroma_client.get_document_by_id(doc_id)
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文档未找到: {doc_id}"
            )
        
        return DocumentResponse(
            id=document["id"],
            content=document["document"],
            metadata=document["metadata"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文档失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文档失败: {str(e)}"
        )

@router.delete("/reset")
async def reset_database():
    """重置数据库（删除所有数据）"""
    try:
        success = chroma_client.reset_collection()
        
        if success:
            return {"message": "数据库重置成功", "status": "success"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="数据库重置失败"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"数据库重置失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"数据库重置失败: {str(e)}"
        )

@router.post("/initialize")
async def initialize_services():
    """初始化服务（加载模型和数据库）"""
    try:
        logger.info("初始化RAG服务...")
        
        # 初始化嵌入模型
        if embedding_model.model is None:
            embedding_model.load_model()
        
        # 初始化数据库
        chroma_client.initialize()
        
        return {
            "message": "服务初始化成功",
            "embedding_model": settings.embedding_model_name,
            "database": "ChromaDB已连接"
        }
        
    except Exception as e:
        logger.error(f"服务初始化失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"服务初始化失败: {str(e)}"
        )