"""
LangGraph节点实现
"""
import logging
import asyncio
from typing import Dict, Any, List, Optional
import json

from .state import AgentState, CallChainNode, AnalysisContext
from clients.rag_client import rag_client
from clients.ollama_client import ollama_client
from config import settings

logger = logging.getLogger(__name__)

async def retrieve_node(state: AgentState) -> AgentState:
    """
    检索节点：根据查询和分析队列检索相关代码片段
    """
    try:
        logger.info(f"执行检索节点，迭代 {state.iteration_count + 1}")
        
        # 确定搜索查询
        if state.iteration_count == 0:
            # 首次检索：使用原始查询
            search_query = state.query
            top_k = settings.initial_search_top_k
        else:
            # 后续检索：基于分析队列
            if state.analysis_queue:
                current_target = state.analysis_queue[0]
                search_query = f"{state.query} {current_target}"
                top_k = settings.dependency_search_top_k
            else:
                # 没有更多分析目标
                return state
        
        logger.info(f"搜索查询: '{search_query}'")
        
        # 执行搜索
        search_result = await rag_client.search_code(
            query=search_query,
            top_k=top_k,
            include_content=True
        )
        
        if search_result.get("error"):
            error_msg = f"搜索失败: {search_result['error']}"
            state.add_error(error_msg)
            logger.error(error_msg)
            return state
        
        # 处理搜索结果
        results = search_result.get("results", [])
        logger.info(f"找到 {len(results)} 个相关结果")
        
        for result in results:
            doc_id = result.get("id")
            content = result.get("content", "")
            metadata = result.get("metadata", {})
            similarity_score = result.get("similarity_score", 0.0)
            
            # 跳过已访问的文档
            if doc_id in state.visited_documents:
                continue
            
            # 添加到上下文
            state.add_context(
                content=content,
                metadata=metadata,
                source="search",
                relevance_score=similarity_score
            )
            
            # 标记为已访问
            state.visited_documents.add(doc_id)
            
            # 记录文件路径
            file_path = metadata.get("filePath")
            if file_path:
                state.visited_files.add(file_path)
        
        # 更新搜索结果
        state.search_results.extend(results)
        
        return state
        
    except Exception as e:
        error_msg = f"检索节点执行失败: {e}"
        state.add_error(error_msg)
        logger.error(error_msg)
        return state

async def analyze_node(state: AgentState) -> AgentState:
    """
    分析节点：使用LLM分析检索到的代码片段
    """
    try:
        logger.info("执行分析节点")
        
        if not state.context_stack:
            state.add_warning("没有可分析的上下文")
            return state
        
        # 构建分析上下文
        context_summary = state.get_context_summary(max_length=settings.context_window_size)
        
        # 生成分析提示
        analysis_prompt = f"""请分析以下代码上下文并回答问题：

## 用户问题
{state.query}

## 分析类型  
{state.analysis_type}

## 代码上下文
{context_summary}

## 已访问文件
{state.get_visited_files_summary()}

## 分析要求
请提供以下内容：
1. 直接回答用户问题
2. 识别关键的函数、组件或模块
3. 分析相关的依赖关系
4. 指出需要进一步分析的文件或定义
5. 提供具体的代码示例和解释

请以JSON格式返回结果，包含以下字段：
- answer: 对问题的直接回答
- key_findings: 关键发现列表
- dependencies: 发现的依赖关系列表
- next_targets: 需要进一步分析的目标列表
- code_examples: 相关代码示例列表
"""
        
        # 调用LLM进行分析
        response = await ollama_client.generate_code_analysis(
            code_context=context_summary,
            question=state.query,
            analysis_type=state.analysis_type
        )
        
        if not response["success"]:
            error_msg = f"LLM分析失败: {response.get('error', '未知错误')}"
            state.add_error(error_msg)
            logger.error(error_msg)
            return state
        
        analysis_content = response["content"]
        
        # 尝试解析JSON结果
        try:
            # 提取JSON部分（如果LLM输出包含其他文本）
            json_start = analysis_content.find('{')
            json_end = analysis_content.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_content = analysis_content[json_start:json_end]
                analysis_result = json.loads(json_content)
            else:
                # 如果没有找到JSON，创建基本结构
                analysis_result = {
                    "answer": analysis_content,
                    "key_findings": [],
                    "dependencies": [],
                    "next_targets": [],
                    "code_examples": []
                }
        except json.JSONDecodeError:
            # JSON解析失败，使用原始内容
            analysis_result = {
                "answer": analysis_content,
                "key_findings": [],
                "dependencies": [],
                "next_targets": [],
                "code_examples": []
            }
        
        # 保存中间结果
        intermediate_result = {
            "iteration": state.iteration_count,
            "node": "analyze",
            "analysis": analysis_result,
            "context_files": len(state.visited_files),
            "timestamp": state.start_time
        }
        state.intermediate_results.append(intermediate_result)
        
        # 更新分析队列
        next_targets = analysis_result.get("next_targets", [])
        for target in next_targets:
            if target not in state.completed_analyses and target not in state.analysis_queue:
                state.analysis_queue.append(target)
        
        # 标记当前分析为已完成
        if state.analysis_queue:
            current_target = state.analysis_queue.pop(0)
            state.completed_analyses.add(current_target)
        
        logger.info(f"分析完成，发现 {len(next_targets)} 个新的分析目标")
        
        return state
        
    except Exception as e:
        error_msg = f"分析节点执行失败: {e}"
        state.add_error(error_msg)
        logger.error(error_msg)
        return state

async def dependency_tracker_node(state: AgentState) -> AgentState:
    """
    依赖追踪节点：分析和构建依赖关系图
    """
    try:
        logger.info("执行依赖追踪节点")
        
        # 从上下文中提取依赖信息
        new_dependencies = []
        
        for context in state.context_stack:
            metadata = context.metadata
            
            # 处理前向引用（依赖）
            if "has_forward_refs" in metadata and metadata["has_forward_refs"]:
                file_path = metadata.get("filePath", "")
                definition_name = metadata.get("definition_name", "")
                qualified_name = metadata.get("qualified_name", definition_name)
                
                # 创建调用链节点
                node = CallChainNode(
                    name=definition_name,
                    file_path=file_path,
                    definition_type=metadata.get("definition_type", "unknown"),
                    qualified_name=qualified_name,
                    depth=len(state.call_chain)
                )
                
                # 搜索具体的依赖信息
                if file_path and file_path not in state.visited_files:
                    dependency_search = await rag_client.search_by_file_path(file_path)
                    
                    if dependency_search.get("results"):
                        for dep_result in dependency_search["results"][:3]:  # 限制结果数量
                            dep_metadata = dep_result.get("metadata", {})
                            if dep_metadata.get("content_type") == "file_summary":
                                # 从文件摘要中提取依赖
                                content = dep_result.get("content", "")
                                if "依赖模块:" in content:
                                    deps_line = content.split("依赖模块:")[1].split("\n")[0]
                                    dependencies = [dep.strip() for dep in deps_line.split(",")]
                                    node.dependencies.extend(dependencies[:settings.max_dependencies_per_file])
                
                state.add_call_chain_node(node)
                new_dependencies.append(node)
        
        logger.info(f"发现 {len(new_dependencies)} 个新的依赖关系")
        
        # 更新分析队列（基于新发现的依赖）
        for dep_node in new_dependencies[-3:]:  # 只处理最近的几个依赖
            for dependency in dep_node.dependencies:
                if (dependency not in state.completed_analyses and 
                    dependency not in state.analysis_queue and
                    len(state.analysis_queue) < 10):  # 限制队列大小
                    state.analysis_queue.append(dependency)
        
        return state
        
    except Exception as e:
        error_msg = f"依赖追踪节点执行失败: {e}"
        state.add_error(error_msg)
        logger.error(error_msg)
        return state

async def context_manager_node(state: AgentState) -> AgentState:
    """
    上下文管理节点：优化和管理分析上下文
    """
    try:
        logger.info("执行上下文管理节点")
        
        # 按相关性排序上下文
        state.context_stack.sort(key=lambda x: x.relevance_score, reverse=True)
        
        # 限制上下文数量
        max_contexts = state.config.get("max_contexts", 15)
        if len(state.context_stack) > max_contexts:
            state.context_stack = state.context_stack[:max_contexts]
            state.add_warning(f"上下文被截断到 {max_contexts} 个项目")
        
        # 去重相似的上下文
        unique_contexts = []
        seen_files = set()
        
        for context in state.context_stack:
            file_path = context.metadata.get("filePath", "")
            qualified_name = context.metadata.get("qualified_name", "")
            
            # 简单去重策略：同一文件的同一定义只保留一个
            key = f"{file_path}::{qualified_name}"
            if key not in seen_files:
                unique_contexts.append(context)
                seen_files.add(key)
        
        state.context_stack = unique_contexts
        
        # 更新当前关注点
        if state.context_stack:
            # 关注相关性最高的项目
            top_context = state.context_stack[0]
            state.current_focus = top_context.metadata.get("qualified_name") or top_context.metadata.get("filePath")
        
        # 增加迭代计数
        state.iteration_count += 1
        
        logger.info(f"上下文管理完成，保留 {len(state.context_stack)} 个上下文")
        
        return state
        
    except Exception as e:
        error_msg = f"上下文管理节点执行失败: {e}"
        state.add_error(error_msg)
        logger.error(error_msg)
        return state

async def router_node(state: AgentState) -> AgentState:
    """
    路由节点：决定下一步操作
    """
    try:
        logger.info("执行路由节点")
        
        # 检查各种条件并记录决策原因
        decision_reasons = []
        
        # 检查迭代次数
        if state.iteration_count >= state.max_iterations:
            decision_reasons.append(f"达到最大迭代次数 ({state.max_iterations})")
        
        # 检查分析队列
        pending_analyses = [item for item in state.analysis_queue if item not in state.completed_analyses]
        if not pending_analyses:
            decision_reasons.append("没有待分析的目标")
        
        # 检查错误数量
        if len(state.errors) > 5:
            decision_reasons.append("错误过多")
        
        # 检查上下文质量
        if len(state.context_stack) >= 10 and state.iteration_count >= 3:
            decision_reasons.append("收集了足够的上下文")
        
        # 记录路由决策
        if decision_reasons:
            logger.info(f"路由决策：生成答案 - {'; '.join(decision_reasons)}")
        else:
            logger.info(f"路由决策：继续分析 - 还有 {len(pending_analyses)} 个待分析目标")
        
        return state
        
    except Exception as e:
        error_msg = f"路由节点执行失败: {e}"
        state.add_error(error_msg)
        logger.error(error_msg)
        return state

async def generate_node(state: AgentState) -> AgentState:
    """
    生成节点：综合所有分析结果生成最终答案
    """
    try:
        logger.info("执行生成节点")
        
        # 构建完整的分析上下文
        context_summary = state.get_context_summary(max_length=settings.context_window_size * 2)
        
        # 构建调用链摘要
        call_chain_summary = ""
        if state.call_chain:
            call_chain_summary = "## 调用链分析\n"
            for i, node in enumerate(state.call_chain):
                call_chain_summary += f"{i+1}. {node.name} ({node.definition_type}) - {node.file_path}\n"
                if node.dependencies:
                    call_chain_summary += f"   依赖: {', '.join(node.dependencies[:3])}\n"
        
        # 构建中间结果摘要
        intermediate_summary = ""
        if state.intermediate_results:
            intermediate_summary = "## 分析过程\n"
            for result in state.intermediate_results[-3:]:  # 只显示最近的几个结果
                analysis = result.get("analysis", {})
                if analysis.get("key_findings"):
                    intermediate_summary += f"迭代 {result['iteration']}: {'; '.join(analysis['key_findings'][:2])}\n"
        
        # 生成最终答案
        final_prompt = f"""基于完整的代码分析过程，请提供对以下问题的全面回答：

## 原始问题
{state.query}

## 分析类型
{state.analysis_type}

## 完整代码上下文
{context_summary}

{call_chain_summary}

{intermediate_summary}

## 统计信息
- 分析迭代次数: {state.iteration_count}
- 访问文件数: {len(state.visited_files)}
- 收集上下文数: {len(state.context_stack)}
- 构建调用链长度: {len(state.call_chain)}

## 要求
请提供一个全面、准确的答案，包括：
1. 直接回答用户问题
2. 总结关键发现
3. 展示相关的调用链或依赖关系
4. 提供具体的代码示例
5. 给出实用的建议或注意事项

答案应该专业、详细，并基于实际的代码分析结果。
"""
        
        response = await ollama_client.generate_response(
            prompt=final_prompt,
            system_message=ollama_client._get_system_message_for_analysis(state.analysis_type),
            temperature=0.1,  # 较低温度确保答案准确
            max_tokens=settings.llm_max_tokens
        )
        
        if response["success"]:
            state.final_answer = response["content"]
            logger.info("最终答案生成成功")
        else:
            error_msg = f"生成最终答案失败: {response.get('error', '未知错误')}"
            state.add_error(error_msg)
            state.final_answer = f"抱歉，由于技术问题无法生成完整答案。错误: {error_msg}"
            logger.error(error_msg)
        
        return state
        
    except Exception as e:
        error_msg = f"生成节点执行失败: {e}"
        state.add_error(error_msg)
        state.final_answer = f"抱歉，生成答案时出现错误: {error_msg}"
        logger.error(error_msg)
        return state