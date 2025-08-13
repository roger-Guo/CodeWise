"""
API数据模型
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from enum import Enum

class AnalysisType(str, Enum):
    """分析类型枚举"""
    GENERAL = "general"
    FUNCTION_ANALYSIS = "function_analysis"
    COMPONENT_ANALYSIS = "component_analysis"
    DEPENDENCY_TRACKING = "dependency_tracking"
    IMPACT_ANALYSIS = "impact_analysis"
    CALL_CHAIN_ANALYSIS = "call_chain_analysis"

class AnalysisRequest(BaseModel):
    """代码分析请求模型"""
    query: str = Field(..., description="分析查询", min_length=1)
    analysis_type: AnalysisType = Field(default=AnalysisType.GENERAL, description="分析类型")
    max_iterations: Optional[int] = Field(default=None, description="最大迭代次数", ge=1, le=20)
    config: Optional[Dict[str, Any]] = Field(default=None, description="额外配置参数")

class CallChainNodeResponse(BaseModel):
    """调用链节点响应模型"""
    name: str = Field(..., description="节点名称")
    file_path: str = Field(..., description="文件路径")
    type: str = Field(..., description="定义类型")
    depth: int = Field(..., description="调用深度")

class AnalysisResponse(BaseModel):
    """代码分析响应模型"""
    success: bool = Field(..., description="分析是否成功")
    query: str = Field(..., description="原始查询")
    analysis_type: str = Field(..., description="分析类型")
    answer: str = Field(..., description="分析答案")
    execution_time: Optional[float] = Field(default=None, description="执行时间（秒）")
    iteration_count: int = Field(..., description="迭代次数")
    visited_files: List[str] = Field(..., description="访问的文件列表")
    call_chain: List[CallChainNodeResponse] = Field(..., description="调用链")
    context_summary: str = Field(..., description="上下文摘要")
    errors: List[str] = Field(default_factory=list, description="错误列表")
    warnings: List[str] = Field(default_factory=list, description="警告列表")
    intermediate_results: List[Dict[str, Any]] = Field(default_factory=list, description="中间结果")

class StreamingAnalysisRequest(BaseModel):
    """流式分析请求模型"""
    query: str = Field(..., description="分析查询", min_length=1)
    analysis_type: AnalysisType = Field(default=AnalysisType.GENERAL, description="分析类型")
    config: Optional[Dict[str, Any]] = Field(default=None, description="额外配置参数")

class ProgressUpdate(BaseModel):
    """进度更新模型"""
    type: str = Field(..., description="更新类型")
    current_node: Optional[str] = Field(default=None, description="当前节点")
    iteration: Optional[int] = Field(default=None, description="当前迭代")
    visited_files_count: Optional[int] = Field(default=None, description="已访问文件数")
    context_count: Optional[int] = Field(default=None, description="上下文数量")
    timestamp: Optional[float] = Field(default=None, description="时间戳")
    message: Optional[str] = Field(default=None, description="进度消息")

class WorkflowVisualizationResponse(BaseModel):
    """工作流可视化响应模型"""
    mermaid_graph: str = Field(..., description="Mermaid格式的流程图")
    node_descriptions: Dict[str, str] = Field(..., description="节点描述")

class ServiceStatusResponse(BaseModel):
    """服务状态响应模型"""
    status: str = Field(..., description="服务状态")
    agent_service: str = Field(..., description="Agent服务状态")
    rag_service: str = Field(..., description="RAG服务状态")
    ollama_service: str = Field(..., description="Ollama服务状态")
    ollama_model: str = Field(..., description="Ollama模型状态")
    timestamp: str = Field(..., description="检查时间")

class ServiceHealthResponse(BaseModel):
    """服务健康检查响应模型"""
    healthy: bool = Field(..., description="整体健康状态")
    services: Dict[str, Any] = Field(..., description="各服务状态详情")
    version: str = Field(..., description="服务版本")

class BatchAnalysisRequest(BaseModel):
    """批量分析请求模型"""
    queries: List[str] = Field(..., description="查询列表", min_items=1, max_items=10)
    analysis_type: AnalysisType = Field(default=AnalysisType.GENERAL, description="分析类型")
    parallel: bool = Field(default=True, description="是否并行执行")

class BatchAnalysisResponse(BaseModel):
    """批量分析响应模型"""
    success: bool = Field(..., description="批量分析是否成功")
    total_queries: int = Field(..., description="总查询数")
    successful_analyses: int = Field(..., description="成功分析数")
    failed_analyses: int = Field(..., description="失败分析数")
    results: List[AnalysisResponse] = Field(..., description="分析结果列表")
    execution_time: float = Field(..., description="总执行时间")

class DependencyAnalysisRequest(BaseModel):
    """依赖分析请求模型"""
    target: str = Field(..., description="分析目标（文件路径或函数名）", min_length=1)
    depth: int = Field(default=3, description="分析深度", ge=1, le=10)
    include_backward: bool = Field(default=True, description="是否包含反向依赖")
    include_forward: bool = Field(default=True, description="是否包含正向依赖")

class DependencyNode(BaseModel):
    """依赖节点模型"""
    name: str = Field(..., description="节点名称")
    file_path: str = Field(..., description="文件路径")
    node_type: str = Field(..., description="节点类型")
    depth: int = Field(..., description="依赖深度")
    dependencies: List[str] = Field(default_factory=list, description="依赖列表")
    dependents: List[str] = Field(default_factory=list, description="依赖者列表")

class DependencyAnalysisResponse(BaseModel):
    """依赖分析响应模型"""
    success: bool = Field(..., description="分析是否成功")
    target: str = Field(..., description="分析目标")
    depth: int = Field(..., description="实际分析深度")
    nodes: List[DependencyNode] = Field(..., description="依赖节点列表")
    graph_data: Dict[str, Any] = Field(..., description="图数据")
    execution_time: float = Field(..., description="执行时间")

class ErrorResponse(BaseModel):
    """错误响应模型"""
    error: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误消息")
    detail: Optional[str] = Field(default=None, description="错误详情")
    timestamp: Optional[str] = Field(default=None, description="错误时间")