"""
LangGraph工作流定义
"""
import logging
import asyncio
from typing import Dict, Any, List, Optional
from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableConfig

from .state import AgentState, CallChainNode, AnalysisContext
from .nodes import (
    retrieve_node,
    analyze_node,
    router_node,
    generate_node,
    dependency_tracker_node,
    context_manager_node
)
from config import settings

logger = logging.getLogger(__name__)

class CodeAnalysisWorkflow:
    """代码分析工作流"""
    
    def __init__(self):
        """初始化工作流"""
        self.graph = None
        self.app = None
        self._build_graph()
    
    def _build_graph(self):
        """构建LangGraph工作流图"""
        # 创建状态图
        workflow = StateGraph(AgentState)
        
        # 添加节点
        workflow.add_node("retrieve", retrieve_node)
        workflow.add_node("analyze", analyze_node)
        workflow.add_node("dependency_tracker", dependency_tracker_node)
        workflow.add_node("context_manager", context_manager_node)
        workflow.add_node("router", router_node)
        workflow.add_node("generate", generate_node)
        
        # 设置入口点
        workflow.set_entry_point("retrieve")
        
        # 定义边和条件
        workflow.add_edge("retrieve", "analyze")
        workflow.add_edge("analyze", "dependency_tracker")
        workflow.add_edge("dependency_tracker", "context_manager")
        workflow.add_edge("context_manager", "router")
        
        # 条件路由
        workflow.add_conditional_edges(
            "router",
            self._router_condition,
            {
                "continue": "retrieve",  # 继续分析
                "generate": "generate",  # 生成答案
                "end": END               # 结束
            }
        )
        
        # 生成节点连接到结束
        workflow.add_edge("generate", END)
        
        # 编译工作流
        self.graph = workflow
        self.app = workflow.compile()
        
        logger.info("LangGraph工作流构建完成")
    
    def _router_condition(self, state: AgentState) -> str:
        """路由条件判断"""
        try:
            # 检查是否达到最大迭代次数
            if state.iteration_count >= state.max_iterations:
                logger.info("达到最大迭代次数，开始生成答案")
                return "generate"
            
            # 检查是否有未完成的分析任务
            if not state.should_continue():
                logger.info("没有更多分析任务，开始生成答案")
                return "generate"
            
            # 检查错误数量
            if len(state.errors) > 5:
                logger.warning("错误过多，结束分析")
                return "end"
            
            # 检查上下文是否足够
            if len(state.context_stack) >= settings.max_context_length // 1000:
                logger.info("上下文已足够，开始生成答案")
                return "generate"
            
            # 继续分析
            logger.info(f"继续分析，当前迭代: {state.iteration_count}")
            return "continue"
            
        except Exception as e:
            logger.error(f"路由条件判断失败: {e}")
            return "generate"  # 出错时直接生成答案
    
    async def run_analysis(
        self,
        query: str,
        analysis_type: str = "general",
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        运行代码分析
        
        Args:
            query: 用户查询
            analysis_type: 分析类型
            config: 配置参数
            
        Returns:
            分析结果
        """
        try:
            # 初始化状态
            initial_state = AgentState(
                query=query,
                analysis_type=analysis_type,
                max_iterations=settings.max_iterations,
                config=config or {}
            )
            
            logger.info(f"开始代码分析: '{query[:50]}...' (类型: {analysis_type})")
            
            # 运行工作流
            final_state = None
            current_state = initial_state
            async for state in self.app.astream(initial_state):
                final_state = state
                
                # 记录进度
                current_node = list(state.keys())[-1] if state else "unknown"
                logger.debug(f"当前节点: {current_node}")
                
                # 更新当前状态
                if state:
                    current_state = list(state.values())[-1]
            
            if final_state is None:
                raise Exception("工作流执行失败，未获得最终状态")
            
            # 使用最终的状态对象
            result_state = current_state
            if hasattr(result_state, 'finalize'):
                result_state.finalize()
            else:
                # 如果result_state是字典，创建AgentState对象
                if isinstance(result_state, dict):
                    result_state = AgentState(**result_state)
                    result_state.finalize()
            
            # 构建结果
            result = {
                "success": True,
                "query": query,
                "analysis_type": analysis_type,
                "answer": result_state.final_answer or "分析完成，但未生成最终答案",
                "execution_time": result_state.execution_time,
                "iteration_count": result_state.iteration_count,
                "visited_files": list(result_state.visited_files),
                "call_chain": [
                    {
                        "name": node.name,
                        "file_path": node.file_path,
                        "type": node.definition_type,
                        "depth": node.depth
                    }
                    for node in result_state.call_chain
                ],
                "context_summary": result_state.get_context_summary(500),
                "errors": result_state.errors,
                "warnings": result_state.warnings,
                "intermediate_results": result_state.intermediate_results
            }
            
            logger.info(f"分析完成，耗时 {result_state.execution_time:.2f}s，迭代 {result_state.iteration_count} 次")
            
            return result
            
        except Exception as e:
            logger.error(f"代码分析失败: {e}")
            return {
                "success": False,
                "query": query,
                "error": str(e),
                "analysis_type": analysis_type
            }
    
    async def run_streaming_analysis(
        self,
        query: str,
        analysis_type: str = "general",
        config: Optional[Dict[str, Any]] = None
    ):
        """
        运行流式代码分析
        
        Args:
            query: 用户查询
            analysis_type: 分析类型
            config: 配置参数
            
        Yields:
            中间状态和最终结果
        """
        try:
            # 初始化状态
            initial_state = AgentState(
                query=query,
                analysis_type=analysis_type,
                max_iterations=settings.max_iterations,
                config=config or {}
            )
            
            logger.info(f"开始流式分析: '{query[:50]}...'")
            
            # 流式运行工作流
            async for state_update in self.app.astream(initial_state):
                if state_update:
                    # 获取当前节点和状态
                    current_node = list(state_update.keys())[-1]
                    current_state = list(state_update.values())[-1]
                    
                    # 生成进度更新
                    progress_update = {
                        "type": "progress",
                        "current_node": current_node,
                        "iteration": current_state.iteration_count,
                        "visited_files_count": len(current_state.visited_files),
                        "context_count": len(current_state.context_stack),
                        "timestamp": current_state.start_time
                    }
                    
                    yield progress_update
                    
                    # 如果有中间结果，也返回
                    if current_state.intermediate_results:
                        latest_result = current_state.intermediate_results[-1]
                        intermediate_update = {
                            "type": "intermediate_result",
                            "result": latest_result,
                            "node": current_node
                        }
                        yield intermediate_update
            
            # 生成最终结果
            final_result = await self.run_analysis(query, analysis_type, config)
            final_update = {
                "type": "final_result",
                "result": final_result
            }
            yield final_update
            
        except Exception as e:
            logger.error(f"流式分析失败: {e}")
            error_update = {
                "type": "error",
                "error": str(e),
                "query": query
            }
            yield error_update
    
    def get_workflow_visualization(self) -> str:
        """获取工作流可视化图表"""
        try:
            # 这里可以使用mermaid格式生成流程图
            mermaid_graph = """
graph TD
    A[开始] --> B[检索 Retrieve]
    B --> C[分析 Analyze]
    C --> D[依赖追踪 Dependency Tracker]
    D --> E[上下文管理 Context Manager]
    E --> F[路由判断 Router]
    F -->|继续分析| B
    F -->|生成答案| G[生成 Generate]
    F -->|结束| H[结束]
    G --> H
"""
            return mermaid_graph
            
        except Exception as e:
            logger.error(f"生成工作流可视化失败: {e}")
            return "无法生成工作流图表"

# 全局工作流实例
workflow = CodeAnalysisWorkflow()