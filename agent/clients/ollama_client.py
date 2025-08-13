"""
Ollama deepseek-coder-v2客户端
"""
import logging
import asyncio
from typing import Dict, List, Any, Optional, AsyncGenerator
import httpx
import json
import ollama
from config import settings

logger = logging.getLogger(__name__)

class OllamaClient:
    """Ollama deepseek-coder-v2客户端"""
    
    def __init__(self, model_name: Optional[str] = None, base_url: Optional[str] = None):
        """
        初始化Ollama客户端
        
        Args:
            model_name: 模型名称，默认使用配置中的模型
            base_url: Ollama服务URL，默认使用配置中的URL
        """
        self.model_name = model_name or settings.llm_model_name
        self.base_url = base_url or settings.ollama_base_url
        self.temperature = settings.llm_temperature
        self.max_tokens = settings.llm_max_tokens
        self._client = None
        
        # 设置ollama客户端
        ollama._client.base_url = self.base_url
        
        logger.info(f"初始化Ollama客户端: {self.model_name} @ {self.base_url}")
    
    async def _get_client(self) -> httpx.AsyncClient:
        """获取异步HTTP客户端"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(120.0),  # 2分钟超时
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            )
        return self._client
    
    async def health_check(self) -> Dict[str, Any]:
        """Ollama服务健康检查"""
        try:
            client = await self._get_client()
            
            # 检查Ollama服务是否可达
            response = await client.get(f"{self.base_url}/api/version")
            
            if response.status_code == 200:
                version_info = response.json()
                
                # 检查模型是否可用
                model_available = await self.check_model_availability()
                
                return {
                    "status": "healthy" if model_available else "model_unavailable",
                    "version": version_info.get("version", "unknown"),
                    "model": self.model_name,
                    "model_available": model_available
                }
            else:
                return {"status": "unhealthy", "error": f"Status code: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Ollama健康检查失败: {e}")
            return {"status": "error", "error": str(e)}
    
    async def check_model_availability(self) -> bool:
        """检查模型是否可用"""
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/api/tags")
            
            if response.status_code == 200:
                models_data = response.json()
                available_models = [model["name"] for model in models_data.get("models", [])]
                
                # 检查我们的模型是否在列表中
                is_available = any(self.model_name in model for model in available_models)
                
                if not is_available:
                    logger.warning(f"模型 {self.model_name} 不在可用模型列表中: {available_models}")
                
                return is_available
            else:
                logger.error(f"无法获取模型列表，状态码: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"检查模型可用性失败: {e}")
            return False
    
    async def generate_response(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        context: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        生成响应
        
        Args:
            prompt: 用户提示
            system_message: 系统消息
            temperature: 温度参数
            max_tokens: 最大令牌数
            context: 对话上下文
            
        Returns:
            生成的响应
        """
        try:
            # 构建消息列表
            messages = []
            
            if system_message:
                messages.append({"role": "system", "content": system_message})
            
            # 添加历史上下文
            if context:
                messages.extend(context)
            
            # 添加当前用户消息
            messages.append({"role": "user", "content": prompt})
            
            # 设置参数
            options = {
                "temperature": temperature or self.temperature,
                "num_predict": max_tokens or self.max_tokens
            }
            
            logger.info(f"发送请求到Ollama: {self.model_name}")
            logger.debug(f"提示长度: {len(prompt)} 字符")
            
            # 调用ollama
            response = await asyncio.to_thread(
                ollama.chat,
                model=self.model_name,
                messages=messages,
                options=options
            )
            
            if response and "message" in response:
                content = response["message"]["content"]
                
                return {
                    "success": True,
                    "content": content,
                    "model": self.model_name,
                    "prompt_tokens": response.get("prompt_eval_count", 0),
                    "completion_tokens": response.get("eval_count", 0),
                    "total_tokens": response.get("prompt_eval_count", 0) + response.get("eval_count", 0)
                }
            else:
                return {"success": False, "error": "无效的响应格式"}
                
        except Exception as e:
            logger.error(f"生成响应失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def generate_code_analysis(
        self,
        code_context: str,
        question: str,
        analysis_type: str = "general"
    ) -> Dict[str, Any]:
        """
        生成代码分析
        
        Args:
            code_context: 代码上下文
            question: 分析问题
            analysis_type: 分析类型
            
        Returns:
            分析结果
        """
        system_message = self._get_system_message_for_analysis(analysis_type)
        
        prompt = f"""基于以下代码上下文，请回答问题：

## 代码上下文
```
{code_context}
```

## 问题
{question}

请提供详细、准确的分析，包括：
1. 直接回答问题
2. 相关代码解释
3. 可能的调用关系
4. 注意事项或建议

"""
        
        return await self.generate_response(
            prompt=prompt,
            system_message=system_message,
            temperature=0.1,  # 代码分析使用较低温度
            max_tokens=2048
        )
    
    def _get_system_message_for_analysis(self, analysis_type: str) -> str:
        """根据分析类型获取系统消息"""
        system_messages = {
            "function_analysis": """你是一个专业的代码分析专家，专门分析JavaScript/TypeScript和React代码中的函数定义、调用关系和逻辑流程。请提供准确、详细的函数分析。""",
            
            "component_analysis": """你是一个React组件分析专家，专门分析React组件的结构、Props、State、Hooks使用和组件间关系。请提供清晰的组件分析。""",
            
            "dependency_tracking": """你是一个代码依赖关系分析专家，专门追踪模块间的导入导出关系、依赖链和影响范围。请提供完整的依赖分析。""",
            
            "impact_analysis": """你是一个代码影响分析专家，专门评估代码修改的影响范围、潜在风险和相关文件。请提供全面的影响分析。""",
            
            "call_chain_analysis": """你是一个调用链分析专家，专门追踪函数/组件的调用路径、执行流程和数据流向。请提供详细的调用链分析。""",
            
            "general": """你是一个全栈代码分析专家，擅长分析JavaScript、TypeScript、React等代码。请提供准确、有用的代码分析和建议。"""
        }
        
        return system_messages.get(analysis_type, system_messages["general"])
    
    async def generate_streaming_response(
        self,
        prompt: str,
        system_message: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """生成流式响应"""
        try:
            messages = []
            
            if system_message:
                messages.append({"role": "system", "content": system_message})
            
            messages.append({"role": "user", "content": prompt})
            
            # 使用ollama的流式接口
            stream = await asyncio.to_thread(
                ollama.chat,
                model=self.model_name,
                messages=messages,
                stream=True,
                options={"temperature": self.temperature}
            )
            
            for chunk in stream:
                if "message" in chunk and "content" in chunk["message"]:
                    yield chunk["message"]["content"]
                    
        except Exception as e:
            logger.error(f"生成流式响应失败: {e}")
            yield f"错误: {str(e)}"
    
    async def summarize_context(self, contexts: List[str], max_length: int = 1000) -> str:
        """总结多个上下文"""
        if not contexts:
            return ""
        
        combined_context = "\n\n".join(contexts)
        
        if len(combined_context) <= max_length:
            return combined_context
        
        # 如果上下文太长，使用LLM进行总结
        prompt = f"""请总结以下代码上下文，保留最重要的信息，限制在{max_length}字符以内：

{combined_context}

总结要求：
1. 保留关键函数和组件名称
2. 保留重要的依赖关系
3. 保留核心逻辑和流程
4. 使用简洁清晰的语言
"""
        
        response = await self.generate_response(
            prompt=prompt,
            system_message="你是一个代码总结专家，擅长提取和总结代码的核心信息。",
            temperature=0.1,
            max_tokens=512
        )
        
        if response["success"]:
            return response["content"]
        else:
            # 如果总结失败，返回截断的原文
            return combined_context[:max_length] + "..."
    
    async def close(self):
        """关闭客户端连接"""
        if self._client:
            await self._client.aclose()
            self._client = None

# 全局Ollama客户端实例
ollama_client = OllamaClient()