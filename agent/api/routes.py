"""
API路由定义
"""
import logging
import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
import json

from config import settings
from core.workflow import workflow
from clients.rag_client import rag_client
from clients.ollama_client import ollama_client
from .models import (
    AnalysisRequest, AnalysisResponse, CallChainNodeResponse,
    StreamingAnalysisRequest, ProgressUpdate,
    WorkflowVisualizationResponse, ServiceStatusResponse, ServiceHealthResponse,
    BatchAnalysisRequest, BatchAnalysisResponse,
    DependencyAnalysisRequest, DependencyAnalysisResponse, DependencyNode,
    ErrorResponse
)

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("/health", response_model=ServiceHealthResponse)
async def health_check():
    """Agent服务健康检查"""
    try:
        services = {}
        overall_healthy = True
        
        # 检查RAG服务
        rag_health = await rag_client.health_check()
        services["rag"] = rag_health
        if rag_health.get("status") != "healthy":
            overall_healthy = False
        
        # 检查Ollama服务
        ollama_health = await ollama_client.health_check()
        services["ollama"] = ollama_health
        if ollama_health.get("status") != "healthy":
            overall_healthy = False
        
        # Agent服务本身
        services["agent"] = {"status": "healthy", "message": "Agent service is running"}
        
        return ServiceHealthResponse(
            healthy=overall_healthy,
            services=services,
            version="1.0.0"
        )
        
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"服务健康检查失败: {str(e)}"
        )

@router.get("/status", response_model=ServiceStatusResponse)
async def service_status():
    """获取详细的服务状态"""
    try:
        # 检查各服务状态
        rag_health = await rag_client.health_check()
        ollama_health = await ollama_client.health_check()
        
        return ServiceStatusResponse(
            status="running",
            agent_service="healthy",
            rag_service=rag_health.get("status", "unknown"),
            ollama_service=ollama_health.get("status", "unknown"), 
            ollama_model=f"{settings.llm_model_name} ({ollama_health.get('model_available', False)})",
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"获取服务状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取服务状态失败: {str(e)}"
        )

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(request: AnalysisRequest):
    """执行代码分析"""
    try:
        logger.info(f"收到代码分析请求: '{request.query[:50]}...' (类型: {request.analysis_type})")
        
        # 准备配置
        config = request.config or {}
        if request.max_iterations:
            config["max_iterations"] = request.max_iterations
        
        # 执行分析
        result = await workflow.run_analysis(
            query=request.query,
            analysis_type=request.analysis_type.value,
            config=config
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"代码分析失败: {result.get('error', '未知错误')}"
            )
        
        # 转换调用链格式
        call_chain = [
            CallChainNodeResponse(
                name=node["name"],
                file_path=node["file_path"],
                type=node["type"],
                depth=node["depth"]
            )
            for node in result.get("call_chain", [])
        ]
        
        response = AnalysisResponse(
            success=result["success"],
            query=result["query"],
            analysis_type=result["analysis_type"],
            answer=result["answer"],
            execution_time=result.get("execution_time"),
            iteration_count=result.get("iteration_count", 0),
            visited_files=result.get("visited_files", []),
            call_chain=call_chain,
            context_summary=result.get("context_summary", ""),
            errors=result.get("errors", []),
            warnings=result.get("warnings", []),
            intermediate_results=result.get("intermediate_results", [])
        )
        
        logger.info(f"分析完成，耗时 {result.get('execution_time', 0):.2f}s")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"代码分析请求处理失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"代码分析请求处理失败: {str(e)}"
        )

@router.post("/analyze-stream")
async def analyze_code_streaming(request: StreamingAnalysisRequest):
    """流式代码分析"""
    
    async def generate_stream():
        """生成流式响应"""
        try:
            logger.info(f"开始流式分析: '{request.query[:50]}...'")
            
            async for update in workflow.run_streaming_analysis(
                query=request.query,
                analysis_type=request.analysis_type.value,
                config=request.config or {}
            ):
                # 转换为SSE格式
                yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                
        except Exception as e:
            error_update = {
                "type": "error",
                "error": str(e),
                "timestamp": time.time()
            }
            yield f"data: {json.dumps(error_update, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )

@router.post("/batch-analyze", response_model=BatchAnalysisResponse)
async def batch_analyze_code(request: BatchAnalysisRequest):
    """批量代码分析"""
    try:
        logger.info(f"收到批量分析请求，共 {len(request.queries)} 个查询")
        start_time = time.time()
        
        results = []
        
        if request.parallel:
            # 并行执行
            tasks = []
            for query in request.queries:
                task = workflow.run_analysis(
                    query=query,
                    analysis_type=request.analysis_type.value,
                    config={}
                )
                tasks.append(task)
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    # 处理异常
                    error_result = {
                        "success": False,
                        "query": request.queries[i],
                        "error": str(result),
                        "analysis_type": request.analysis_type.value
                    }
                    results.append(error_result)
                else:
                    results.append(result)
        else:
            # 顺序执行
            for query in request.queries:
                try:
                    result = await workflow.run_analysis(
                        query=query,
                        analysis_type=request.analysis_type.value,
                        config={}
                    )
                    results.append(result)
                except Exception as e:
                    error_result = {
                        "success": False,
                        "query": query,
                        "error": str(e),
                        "analysis_type": request.analysis_type.value
                    }
                    results.append(error_result)
        
        execution_time = time.time() - start_time
        successful_count = sum(1 for r in results if r.get("success", False))
        failed_count = len(results) - successful_count
        
        # 转换结果格式
        formatted_results = []
        for result in results:
            if result.get("success", False):
                call_chain = [
                    CallChainNodeResponse(
                        name=node["name"],
                        file_path=node["file_path"],
                        type=node["type"],
                        depth=node["depth"]
                    )
                    for node in result.get("call_chain", [])
                ]
                
                formatted_result = AnalysisResponse(
                    success=result["success"],
                    query=result["query"],
                    analysis_type=result["analysis_type"],
                    answer=result["answer"],
                    execution_time=result.get("execution_time"),
                    iteration_count=result.get("iteration_count", 0),
                    visited_files=result.get("visited_files", []),
                    call_chain=call_chain,
                    context_summary=result.get("context_summary", ""),
                    errors=result.get("errors", []),
                    warnings=result.get("warnings", []),
                    intermediate_results=result.get("intermediate_results", [])
                )
                formatted_results.append(formatted_result)
            else:
                # 错误结果
                error_result = AnalysisResponse(
                    success=False,
                    query=result["query"],
                    analysis_type=result["analysis_type"],
                    answer=f"分析失败: {result.get('error', '未知错误')}",
                    execution_time=0,
                    iteration_count=0,
                    visited_files=[],
                    call_chain=[],
                    context_summary="",
                    errors=[result.get("error", "未知错误")],
                    warnings=[],
                    intermediate_results=[]
                )
                formatted_results.append(error_result)
        
        response = BatchAnalysisResponse(
            success=True,
            total_queries=len(request.queries),
            successful_analyses=successful_count,
            failed_analyses=failed_count,
            results=formatted_results,
            execution_time=execution_time
        )
        
        logger.info(f"批量分析完成，成功 {successful_count}/{len(request.queries)}，耗时 {execution_time:.2f}s")
        return response
        
    except Exception as e:
        logger.error(f"批量分析失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量分析失败: {str(e)}"
        )

@router.get("/workflow-visualization", response_model=WorkflowVisualizationResponse)
async def get_workflow_visualization():
    """获取工作流可视化图表"""
    try:
        mermaid_graph = workflow.get_workflow_visualization()
        
        node_descriptions = {
            "retrieve": "检索节点：根据查询搜索相关代码片段",
            "analyze": "分析节点：使用LLM分析代码并提取关键信息",
            "dependency_tracker": "依赖追踪节点：构建和分析依赖关系图",
            "context_manager": "上下文管理节点：优化和管理分析上下文",
            "router": "路由节点：决定继续分析还是生成最终答案",
            "generate": "生成节点：综合所有分析结果生成最终答案"
        }
        
        return WorkflowVisualizationResponse(
            mermaid_graph=mermaid_graph,
            node_descriptions=node_descriptions
        )
        
    except Exception as e:
        logger.error(f"获取工作流可视化失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取工作流可视化失败: {str(e)}"
        )

@router.post("/dependency-analysis", response_model=DependencyAnalysisResponse)
async def analyze_dependencies(request: DependencyAnalysisRequest):
    """分析依赖关系"""
    try:
        start_time = time.time()
        logger.info(f"开始依赖分析: {request.target}")
        
        # 构建依赖分析查询
        dependency_query = f"分析 {request.target} 的依赖关系"
        
        # 执行依赖分析
        analysis_result = await workflow.run_analysis(
            query=dependency_query,
            analysis_type="dependency_tracking",
            config={
                "max_iterations": min(request.depth * 2, 10),
                "focus_on_dependencies": True
            }
        )
        
        if not analysis_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"依赖分析失败: {analysis_result.get('error', '未知错误')}"
            )
        
        # 转换调用链为依赖节点
        dependency_nodes = []
        for i, chain_node in enumerate(analysis_result.get("call_chain", [])):
            if i >= request.depth * 5:  # 限制节点数量
                break
                
            node = DependencyNode(
                name=chain_node["name"],
                file_path=chain_node["file_path"],
                node_type=chain_node["type"],
                depth=min(chain_node["depth"], request.depth),
                dependencies=[],  # 这里可以进一步解析依赖关系
                dependents=[]
            )
            dependency_nodes.append(node)
        
        # 构建图数据（用于可视化）
        graph_data = {
            "nodes": [
                {
                    "id": node.name,
                    "label": node.name,
                    "type": node.node_type,
                    "file": node.file_path,
                    "depth": node.depth
                }
                for node in dependency_nodes
            ],
            "edges": []  # 这里可以添加边的信息
        }
        
        execution_time = time.time() - start_time
        
        response = DependencyAnalysisResponse(
            success=True,
            target=request.target,
            depth=min(len(dependency_nodes), request.depth),
            nodes=dependency_nodes,
            graph_data=graph_data,
            execution_time=execution_time
        )
        
        logger.info(f"依赖分析完成，找到 {len(dependency_nodes)} 个节点，耗时 {execution_time:.2f}s")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"依赖分析失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"依赖分析失败: {str(e)}"
        )