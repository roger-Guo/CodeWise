"""
RAG服务客户端
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from config import settings

logger = logging.getLogger(__name__)

class RAGServiceClient:
    """RAG服务客户端"""
    
    def __init__(self, base_url: Optional[str] = None):
        """
        初始化RAG服务客户端
        
        Args:
            base_url: RAG服务基础URL，默认使用配置中的URL
        """
        self.base_url = base_url or settings.rag_api_base
        self.timeout = 30.0
        self._client = None
        
    async def _get_client(self) -> httpx.AsyncClient:
        """获取异步HTTP客户端"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                limits=httpx.Limits(max_keepalive_connections=10, max_connections=20)
            )
        return self._client
    
    async def health_check(self) -> Dict[str, Any]:
        """RAG服务健康检查"""
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                return {"status": "healthy", "data": response.json()}
            else:
                return {"status": "unhealthy", "error": f"Status code: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"RAG服务健康检查失败: {e}")
            return {"status": "error", "error": str(e)}
    
    async def search_code(
        self,
        query: str,
        top_k: int = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
        include_content: bool = True
    ) -> Dict[str, Any]:
        """
        搜索代码片段
        
        Args:
            query: 搜索查询
            top_k: 返回结果数量
            filter_metadata: 元数据过滤条件
            include_content: 是否包含文档内容
            
        Returns:
            搜索结果
        """
        try:
            client = await self._get_client()
            
            payload = {
                "query": query,
                "top_k": top_k or settings.initial_search_top_k,
                "include_content": include_content
            }
            
            if filter_metadata:
                payload["filter_metadata"] = filter_metadata
            
            logger.info(f"搜索代码: '{query[:50]}...' (top_k={payload['top_k']})")
            
            response = await client.post(
                f"{self.base_url}/search",
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"搜索成功，找到 {result.get('total', 0)} 个结果")
                return result
            else:
                error_msg = f"搜索失败，状态码: {response.status_code}"
                logger.error(error_msg)
                return {"error": error_msg, "results": [], "total": 0}
                
        except Exception as e:
            error_msg = f"搜索代码出错: {e}"
            logger.error(error_msg)
            return {"error": error_msg, "results": [], "total": 0}
    
    async def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取特定文档"""
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/document/{doc_id}")
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                logger.warning(f"文档未找到: {doc_id}")
                return None
            else:
                logger.error(f"获取文档失败，状态码: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"获取文档出错: {e}")
            return None
    
    async def get_database_stats(self) -> Dict[str, Any]:
        """获取数据库统计信息"""
        try:
            client = await self._get_client()
            response = await client.get(f"{self.base_url}/stats")
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"状态码: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"获取统计信息出错: {e}")
            return {"error": str(e)}
    
    async def search_by_file_path(self, file_path: str) -> Dict[str, Any]:
        """根据文件路径搜索相关代码"""
        filter_metadata = {"filePath": file_path}
        
        return await self.search_code(
            query=f"文件: {file_path}",
            top_k=10,
            filter_metadata=filter_metadata,
            include_content=True
        )
    
    async def search_by_definition_type(
        self,
        definition_type: str,
        query: str = "",
        top_k: int = None
    ) -> Dict[str, Any]:
        """根据定义类型搜索（如component, function, class）"""
        filter_metadata = {"definition_type": definition_type}
        
        search_query = f"{definition_type} {query}".strip()
        
        return await self.search_code(
            query=search_query,
            top_k=top_k or settings.dependency_search_top_k,
            filter_metadata=filter_metadata,
            include_content=True
        )
    
    async def search_dependencies(
        self,
        source_modules: List[str]
    ) -> Dict[str, Any]:
        """搜索特定模块的依赖关系"""
        results = {"dependencies": [], "total": 0}
        
        for module in source_modules:
            try:
                # 搜索导入该模块的代码
                search_result = await self.search_code(
                    query=f"导入 {module}",
                    top_k=settings.dependency_search_top_k,
                    include_content=True
                )
                
                if search_result.get("results"):
                    results["dependencies"].extend(search_result["results"])
                    results["total"] += len(search_result["results"])
                    
            except Exception as e:
                logger.error(f"搜索依赖 {module} 失败: {e}")
                continue
        
        logger.info(f"找到 {results['total']} 个依赖关系")
        return results
    
    async def batch_search(
        self,
        queries: List[str],
        top_k_per_query: int = 3
    ) -> Dict[str, Any]:
        """批量搜索查询"""
        results = {"queries": {}, "total_results": 0}
        
        # 并发执行搜索
        tasks = []
        for query in queries:
            task = self.search_code(
                query=query,
                top_k=top_k_per_query,
                include_content=True
            )
            tasks.append(task)
        
        try:
            search_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, result in enumerate(search_results):
                query = queries[i]
                
                if isinstance(result, Exception):
                    logger.error(f"批量搜索查询 '{query}' 失败: {result}")
                    results["queries"][query] = {"error": str(result), "results": []}
                else:
                    results["queries"][query] = result
                    results["total_results"] += result.get("total", 0)
            
        except Exception as e:
            logger.error(f"批量搜索失败: {e}")
        
        return results
    
    async def close(self):
        """关闭客户端连接"""
        if self._client:
            await self._client.aclose()
            self._client = None

# 全局RAG客户端实例
rag_client = RAGServiceClient()