"""
API数据模型
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class SearchRequest(BaseModel):
    """搜索请求模型"""
    query: str = Field(..., description="搜索查询文本", min_length=1)
    top_k: Optional[int] = Field(default=10, description="返回结果数量", ge=1, le=50)
    filter_metadata: Optional[Dict[str, Any]] = Field(default=None, description="元数据过滤条件")
    include_content: bool = Field(default=True, description="是否包含文档内容")

class SearchResult(BaseModel):
    """单个搜索结果"""
    id: str = Field(..., description="文档ID")
    content: Optional[str] = Field(default=None, description="文档内容")
    metadata: Dict[str, Any] = Field(..., description="文档元数据")
    similarity_score: float = Field(..., description="相似度分数", ge=0.0, le=1.0)

class SearchResponse(BaseModel):
    """搜索响应模型"""
    query: str = Field(..., description="搜索查询")
    results: List[SearchResult] = Field(..., description="搜索结果列表")
    total: int = Field(..., description="结果总数")
    execution_time: float = Field(..., description="执行时间（秒）")

class LoadDataRequest(BaseModel):
    """数据加载请求模型"""
    reload: bool = Field(default=False, description="是否重新加载（清空现有数据）")
    batch_size: int = Field(default=10, description="批处理大小", ge=1, le=100)

class LoadDataResponse(BaseModel):
    """数据加载响应模型"""
    success: bool = Field(..., description="加载是否成功")
    total_files: int = Field(..., description="总文件数")
    loaded_files: int = Field(..., description="成功加载的文件数")
    failed_files: int = Field(..., description="失败的文件数")
    total_entries: int = Field(..., description="总条目数")
    execution_time: float = Field(..., description="执行时间（秒）")
    message: str = Field(..., description="执行消息")

class DatabaseStats(BaseModel):
    """数据库统计信息模型"""
    collection_name: str = Field(..., description="集合名称")
    document_count: int = Field(..., description="文档数量")
    embedding_model: str = Field(..., description="嵌入模型")
    metadata: Dict[str, Any] = Field(..., description="集合元数据")

class DocumentRequest(BaseModel):
    """文档请求模型"""
    id: str = Field(..., description="文档ID")

class DocumentResponse(BaseModel):
    """文档响应模型"""
    id: str = Field(..., description="文档ID")
    content: str = Field(..., description="文档内容")
    metadata: Dict[str, Any] = Field(..., description="文档元数据")

class HealthCheckResponse(BaseModel):
    """健康检查响应模型"""
    status: str = Field(..., description="服务状态")
    version: str = Field(..., description="服务版本")
    embedding_model: str = Field(..., description="嵌入模型状态")
    database: str = Field(..., description="数据库状态")
    timestamp: str = Field(..., description="检查时间")

class ErrorResponse(BaseModel):
    """错误响应模型"""
    error: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误消息")
    detail: Optional[str] = Field(default=None, description="错误详情")