"""
ChromaDB 客户端封装
"""
import logging
import json
import uuid
from typing import List, Dict, Any, Optional, Tuple
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
import numpy as np

from config import settings
from models.embedding_model import embedding_model

logger = logging.getLogger(__name__)

class ChromaDBClient:
    """ChromaDB客户端"""
    
    def __init__(self):
        """初始化ChromaDB客户端"""
        self.client = None
        self.collection = None
        self._embedding_function = None
        
    def _get_embedding_function(self):
        """获取嵌入函数"""
        if self._embedding_function is None:
            class BGEEmbeddingFunction(embedding_functions.EmbeddingFunction):
                def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
                    # 使用我们的BGE-M3模型进行嵌入
                    embeddings = embedding_model.encode(input)
                    return embeddings.tolist()
            
            self._embedding_function = BGEEmbeddingFunction()
        return self._embedding_function
    
    def initialize(self):
        """初始化数据库连接"""
        try:
            logger.info("初始化ChromaDB客户端...")
            
            # 创建持久化客户端
            self.client = chromadb.PersistentClient(
                path=str(settings.chroma_db_path),
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            
            # 获取或创建集合
            self.collection = self.client.get_or_create_collection(
                name=settings.chroma_collection_name,
                embedding_function=self._get_embedding_function(),
                metadata={
                    "description": "CodeWise代码知识图谱向量存储",
                    "embedding_model": settings.embedding_model_name,
                    "dimension": settings.embedding_dimension
                }
            )
            
            logger.info(f"成功初始化ChromaDB集合: {settings.chroma_collection_name}")
            logger.info(f"数据库路径: {settings.chroma_db_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"ChromaDB初始化失败: {e}")
            raise RuntimeError(f"无法初始化ChromaDB: {e}")
    
    def add_documents(
        self,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: Optional[List[str]] = None
    ) -> bool:
        """
        添加文档到向量数据库
        
        Args:
            documents: 文档文本列表
            metadatas: 文档元数据列表
            ids: 文档ID列表，如果为None则自动生成
            
        Returns:
            添加是否成功
        """
        if self.collection is None:
            self.initialize()
        
        try:
            # 生成ID（如果未提供）
            if ids is None:
                ids = [str(uuid.uuid4()) for _ in documents]
            
            # 确保所有列表长度一致
            if not (len(documents) == len(metadatas) == len(ids)):
                raise ValueError("documents, metadatas, ids 长度必须一致")
            
            # 添加文档
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            logger.info(f"成功添加 {len(documents)} 个文档到向量数据库")
            return True
            
        except Exception as e:
            logger.error(f"添加文档失败: {e}")
            return False
    
    def search(
        self,
        query: str,
        top_k: int = None,
        where: Optional[Dict[str, Any]] = None,
        include: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        搜索相似文档
        
        Args:
            query: 查询文本
            top_k: 返回结果数量
            where: 元数据过滤条件
            include: 包含的字段列表
            
        Returns:
            搜索结果
        """
        if self.collection is None:
            self.initialize()
        
        top_k = top_k or settings.default_top_k
        include = include or ["documents", "metadatas", "distances"]
        
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where,
                include=include
            )
            
            logger.info(f"搜索查询: '{query[:50]}...' 返回 {len(results['ids'][0])} 个结果")
            
            # 计算相似度分数（将距离转换为相似度）
            similarity_scores = []
            if "distances" in results and results["distances"]:
                for distance in results["distances"][0]:
                    # 使用余弦相似度：similarity = 1 - distance
                    # ChromaDB默认使用L2距离，需要转换为相似度分数
                    if distance is not None:
                        # 对于L2距离，相似度 = 1 / (1 + distance)
                        similarity = 1 / (1 + distance) if distance >= 0 else 1.0
                        similarity_scores.append(float(similarity))
                    else:
                        similarity_scores.append(0.0)
            
            return {
                "query": query,
                "results": {
                    "ids": results["ids"][0] if "ids" in results else [],
                    "documents": results["documents"][0] if "documents" in results else [],
                    "metadatas": results["metadatas"][0] if "metadatas" in results else [],
                    "distances": results["distances"][0] if "distances" in results else [],
                    "similarity_scores": similarity_scores
                },
                "total": len(results["ids"][0]) if "ids" in results else 0
            }
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return {
                "query": query,
                "results": {"ids": [], "documents": [], "metadatas": [], "distances": []},
                "total": 0,
                "error": str(e)
            }
    
    def get_document_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取文档"""
        if self.collection is None:
            self.initialize()
        
        try:
            results = self.collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"]
            )
            
            if results["ids"]:
                return {
                    "id": results["ids"][0],
                    "document": results["documents"][0],
                    "metadata": results["metadatas"][0]
                }
            return None
            
        except Exception as e:
            logger.error(f"获取文档失败: {e}")
            return None
    
    def update_document(
        self,
        doc_id: str,
        document: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """更新文档"""
        if self.collection is None:
            self.initialize()
        
        try:
            update_data = {"ids": [doc_id]}
            
            if document is not None:
                update_data["documents"] = [document]
            
            if metadata is not None:
                update_data["metadatas"] = [metadata]
            
            self.collection.update(**update_data)
            
            logger.info(f"成功更新文档: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"更新文档失败: {e}")
            return False
    
    def delete_document(self, doc_id: str) -> bool:
        """删除文档"""
        if self.collection is None:
            self.initialize()
        
        try:
            self.collection.delete(ids=[doc_id])
            logger.info(f"成功删除文档: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            return False
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """获取集合统计信息"""
        if self.collection is None:
            self.initialize()
        
        try:
            count = self.collection.count()
            return {
                "name": self.collection.name,
                "count": count,
                "metadata": self.collection.metadata
            }
            
        except Exception as e:
            logger.error(f"获取统计信息失败: {e}")
            return {"error": str(e)}
    
    def reset_collection(self) -> bool:
        """重置集合（删除所有数据）"""
        if self.collection is None:
            self.initialize()
        
        try:
            self.client.delete_collection(settings.chroma_collection_name)
            self.collection = self.client.create_collection(
                name=settings.chroma_collection_name,
                embedding_function=self._get_embedding_function()
            )
            
            logger.info("成功重置ChromaDB集合")
            return True
            
        except Exception as e:
            logger.error(f"重置集合失败: {e}")
            return False

# 全局ChromaDB客户端实例
chroma_client = ChromaDBClient()