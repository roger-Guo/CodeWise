"""
LangGraph状态定义
"""
from typing import Dict, List, Any, Optional, Set
from pydantic import BaseModel, Field
from dataclasses import dataclass
import time

@dataclass
class AnalysisContext:
    """分析上下文"""
    content: str
    metadata: Dict[str, Any]
    source: str  # "search" | "document" | "dependency"
    relevance_score: float = 0.0
    timestamp: float = Field(default_factory=time.time)

@dataclass 
class CallChainNode:
    """调用链节点"""
    name: str
    file_path: str
    definition_type: str  # "function" | "component" | "class"
    qualified_name: str
    dependencies: List[str] = Field(default_factory=list)
    dependents: List[str] = Field(default_factory=list)
    depth: int = 0

class AgentState(BaseModel):
    """Agent工作流状态"""
    
    # 输入相关
    query: str = Field(..., description="用户查询")
    analysis_type: str = Field(default="general", description="分析类型")
    
    # 检索相关
    search_results: List[Dict[str, Any]] = Field(default_factory=list, description="搜索结果")
    visited_documents: Set[str] = Field(default_factory=set, description="已访问的文档ID")
    visited_files: Set[str] = Field(default_factory=set, description="已访问的文件路径")
    
    # 上下文管理
    context_stack: List[AnalysisContext] = Field(default_factory=list, description="上下文栈")
    current_focus: Optional[str] = Field(default=None, description="当前关注的文件或定义")
    
    # 调用链追踪
    call_chain: List[CallChainNode] = Field(default_factory=list, description="调用链")
    dependency_graph: Dict[str, List[str]] = Field(default_factory=dict, description="依赖图")
    
    # 分析状态
    analysis_queue: List[str] = Field(default_factory=list, description="待分析队列")
    completed_analyses: Set[str] = Field(default_factory=set, description="已完成的分析")
    
    # 迭代控制
    iteration_count: int = Field(default=0, description="迭代次数")
    max_iterations: int = Field(default=10, description="最大迭代次数")
    
    # 结果相关
    intermediate_results: List[Dict[str, Any]] = Field(default_factory=list, description="中间结果")
    final_answer: Optional[str] = Field(default=None, description="最终答案")
    
    # 元数据
    start_time: float = Field(default_factory=time.time, description="开始时间")
    execution_time: Optional[float] = Field(default=None, description="执行时间")
    
    # 错误处理
    errors: List[str] = Field(default_factory=list, description="错误列表")
    warnings: List[str] = Field(default_factory=list, description="警告列表")
    
    # 配置
    config: Dict[str, Any] = Field(default_factory=dict, description="配置参数")
    
    class Config:
        arbitrary_types_allowed = True
        
    def add_context(self, content: str, metadata: Dict[str, Any], source: str, relevance_score: float = 0.0):
        """添加分析上下文"""
        context = AnalysisContext(
            content=content,
            metadata=metadata,
            source=source,
            relevance_score=relevance_score
        )
        self.context_stack.append(context)
        
        # 保持上下文栈大小限制
        max_contexts = self.config.get("max_contexts", 20)
        if len(self.context_stack) > max_contexts:
            # 移除相关性最低的上下文
            self.context_stack.sort(key=lambda x: x.relevance_score, reverse=True)
            self.context_stack = self.context_stack[:max_contexts]
    
    def add_call_chain_node(self, node: CallChainNode):
        """添加调用链节点"""
        self.call_chain.append(node)
        
        # 更新依赖图
        for dep in node.dependencies:
            if node.qualified_name not in self.dependency_graph:
                self.dependency_graph[node.qualified_name] = []
            if dep not in self.dependency_graph[node.qualified_name]:
                self.dependency_graph[node.qualified_name].append(dep)
    
    def should_continue(self) -> bool:
        """判断是否应该继续迭代"""
        if self.iteration_count >= self.max_iterations:
            return False
        
        if not self.analysis_queue:
            return False
        
        # 检查是否有新的分析目标
        pending_analyses = [item for item in self.analysis_queue if item not in self.completed_analyses]
        return len(pending_analyses) > 0
    
    def get_context_summary(self, max_length: int = 2000) -> str:
        """获取上下文摘要"""
        if not self.context_stack:
            return ""
        
        # 按相关性排序
        sorted_contexts = sorted(self.context_stack, key=lambda x: x.relevance_score, reverse=True)
        
        summary_parts = []
        current_length = 0
        
        for context in sorted_contexts:
            content_preview = context.content[:500] + "..." if len(context.content) > 500 else context.content
            
            if current_length + len(content_preview) > max_length:
                break
            
            summary_parts.append(f"## {context.source}\n{content_preview}")
            current_length += len(content_preview)
        
        return "\n\n".join(summary_parts)
    
    def get_visited_files_summary(self) -> str:
        """获取已访问文件摘要"""
        if not self.visited_files:
            return "尚未访问任何文件"
        
        return f"已访问 {len(self.visited_files)} 个文件: " + ", ".join(sorted(self.visited_files)[:10])
    
    def add_error(self, error: str):
        """添加错误"""
        self.errors.append(f"[{time.time()}] {error}")
    
    def add_warning(self, warning: str):
        """添加警告"""
        self.warnings.append(f"[{time.time()}] {warning}")
    
    def finalize(self):
        """完成分析"""
        if self.start_time:
            self.execution_time = time.time() - self.start_time