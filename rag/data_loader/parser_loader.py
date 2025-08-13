"""
解析器输出数据加载器
"""
import logging
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Generator, Tuple
import aiofiles

from config import settings
from database.chroma_client import chroma_client

logger = logging.getLogger(__name__)

class CodeKnowledgeGraphLoader:
    """代码知识图谱数据加载器"""
    
    def __init__(self, parser_output_dir: Optional[Path] = None):
        """
        初始化数据加载器
        
        Args:
            parser_output_dir: 解析器输出目录，默认使用配置中的路径
        """
        self.parser_output_dir = parser_output_dir or settings.parser_output_dir
        self.loaded_files_count = 0
        self.failed_files_count = 0
        
    def discover_json_files(self) -> List[Path]:
        """发现所有解析器输出的JSON文件"""
        json_files = []
        
        if not self.parser_output_dir.exists():
            logger.warning(f"解析器输出目录不存在: {self.parser_output_dir}")
            return json_files
        
        # 查找所有JSON文件（排除project-summary.json）
        for json_file in self.parser_output_dir.rglob("*.json"):
            if json_file.name != "project-summary.json":
                json_files.append(json_file)
        
        logger.info(f"发现 {len(json_files)} 个JSON文件")
        return json_files
    
    async def load_json_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """异步加载JSON文件"""
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                return json.loads(content)
        except Exception as e:
            logger.error(f"加载JSON文件失败 {file_path}: {e}")
            return None
    
    def extract_searchable_content(self, data: Dict[str, Any]) -> List[Tuple[str, Dict[str, Any]]]:
        """
        从解析结果中提取可搜索的内容
        
        Returns:
            List of (content, metadata) tuples
        """
        searchable_items = []
        
        # 检查数据结构
        if "fileMetadata" not in data:
            logger.warning("JSON数据缺少fileMetadata字段")
            return searchable_items
        
        file_metadata = data["fileMetadata"]
        file_path = file_metadata.get("filePath", "unknown")
        
        # 1. 处理完整文件信息（如果是文件级JSON）
        if "fileDefinitions" in data:
            # 构建文件级别的搜索内容
            file_content_parts = []
            
            # 添加文件路径
            file_content_parts.append(f"文件路径: {file_path}")
            
            # 添加文件定义摘要
            definitions = data.get("fileDefinitions", [])
            if definitions:
                def_summary = []
                for defn in definitions:
                    def_type = defn.get("definitionType", "unknown")
                    def_name = defn.get("name", "unnamed")
                    def_summary.append(f"{def_type}: {def_name}")
                
                file_content_parts.append(f"定义摘要: {', '.join(def_summary)}")
            
            # 添加依赖信息
            dep_info = data.get("dependencyInfo", {})
            if dep_info.get("forwardReferences"):
                forward_refs = [ref.get("source", "") for ref in dep_info["forwardReferences"]]
                file_content_parts.append(f"依赖模块: {', '.join(forward_refs)}")
            
            file_content = "\n".join(file_content_parts)
            
            file_metadata_enhanced = {
                **file_metadata,
                "content_type": "file_summary",
                "definition_count": len(definitions),
                "has_dependencies": bool(dep_info.get("forwardReferences")),
                "is_exported": bool(dep_info.get("backwardReferences"))
            }
            
            searchable_items.append((file_content, file_metadata_enhanced))
        
        # 2. 处理单个定义信息（如果是定义级JSON）
        if "definitionInfo" in data:
            definition = data["definitionInfo"]
            
            # 构建定义级别的搜索内容
            def_content_parts = []
            
            # 基本信息
            def_name = definition.get("name", "unnamed")
            def_type = definition.get("definitionType", "unknown")
            qualified_name = definition.get("qualifiedName", def_name)
            
            def_content_parts.append(f"定义名称: {def_name}")
            def_content_parts.append(f"定义类型: {def_type}")
            def_content_parts.append(f"完全限定名: {qualified_name}")
            def_content_parts.append(f"所在文件: {file_path}")
            
            # 作用域信息
            scope_path = definition.get("scopePath")
            if scope_path:
                def_content_parts.append(f"作用域: {scope_path}")
            
            # 代码块
            code_block = definition.get("codeBlock")
            if code_block:
                def_content_parts.append(f"代码: {code_block}")
            
            # 描述
            description = definition.get("description")
            if description:
                def_content_parts.append(f"描述: {description}")
            
            def_content = "\n".join(def_content_parts)
            
            def_metadata = {
                **file_metadata,
                "content_type": "definition",
                "definition_name": def_name,
                "definition_type": def_type,
                "qualified_name": qualified_name,
                "scope_path": scope_path,
                "is_top_level": definition.get("isTopLevel", False),
                "start_line": definition.get("startLine"),
                "end_line": definition.get("endLine"),
                "is_exported": definition.get("exportInfo", {}).get("isExported", False)
            }
            
            # 添加依赖信息到元数据
            dep_info = data.get("dependencyInfo", {})
            if dep_info:
                def_metadata.update({
                    "has_forward_refs": bool(dep_info.get("forwardReferences")),
                    "has_backward_refs": bool(dep_info.get("backwardReferences")),
                    "used_imports_count": len(dep_info.get("usedImports", []))
                })
            
            searchable_items.append((def_content, def_metadata))
        
        return searchable_items
    
    async def load_single_file(self, file_path: Path) -> int:
        """加载单个JSON文件到向量数据库"""
        data = await self.load_json_file(file_path)
        if not data:
            self.failed_files_count += 1
            return 0
        
        try:
            # 提取可搜索内容
            searchable_items = self.extract_searchable_content(data)
            
            if not searchable_items:
                logger.warning(f"文件无可搜索内容: {file_path}")
                return 0
            
            # 准备批量插入数据
            documents = []
            metadatas = []
            ids = []
            
            for i, (content, metadata) in enumerate(searchable_items):
                # 生成唯一ID
                relative_path = file_path.relative_to(self.parser_output_dir)
                doc_id = f"{str(relative_path).replace('/', '_').replace('.json', '')}_{i}"
                
                documents.append(content)
                metadatas.append(metadata)
                ids.append(doc_id)
            
            # 插入到向量数据库
            success = chroma_client.add_documents(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            
            if success:
                logger.info(f"成功加载文件: {file_path} ({len(searchable_items)} 个条目)")
                self.loaded_files_count += 1
                return len(searchable_items)
            else:
                logger.error(f"插入向量数据库失败: {file_path}")
                self.failed_files_count += 1
                return 0
                
        except Exception as e:
            logger.error(f"处理文件失败 {file_path}: {e}")
            self.failed_files_count += 1
            return 0
    
    async def load_all_files(self, batch_size: int = 10) -> Dict[str, int]:
        """加载所有JSON文件到向量数据库"""
        logger.info("开始加载解析器输出数据到向量数据库...")
        
        # 初始化数据库
        chroma_client.initialize()
        
        # 发现所有JSON文件
        json_files = self.discover_json_files()
        
        if not json_files:
            logger.warning("未找到JSON文件")
            return {"total_files": 0, "loaded_files": 0, "failed_files": 0, "total_entries": 0}
        
        # 重置计数器
        self.loaded_files_count = 0
        self.failed_files_count = 0
        total_entries = 0
        
        # 批量处理文件
        for i in range(0, len(json_files), batch_size):
            batch_files = json_files[i:i + batch_size]
            
            # 并发处理当前批次
            tasks = [self.load_single_file(file_path) for file_path in batch_files]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 统计结果
            for result in batch_results:
                if isinstance(result, int):
                    total_entries += result
                else:
                    logger.error(f"批次处理出错: {result}")
                    self.failed_files_count += 1
            
            logger.info(f"已处理 {min(i + batch_size, len(json_files))}/{len(json_files)} 个文件")
        
        results = {
            "total_files": len(json_files),
            "loaded_files": self.loaded_files_count,
            "failed_files": self.failed_files_count,
            "total_entries": total_entries
        }
        
        logger.info(f"数据加载完成: {results}")
        return results
    
    async def reload_data(self) -> Dict[str, int]:
        """重新加载所有数据（先清空数据库）"""
        logger.info("重新加载数据，先清空向量数据库...")
        
        # 重置数据库
        chroma_client.reset_collection()
        
        # 重新加载数据
        return await self.load_all_files()

# 全局数据加载器实例
parser_loader = CodeKnowledgeGraphLoader()