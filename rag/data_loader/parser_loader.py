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
        
        # 适配新的JSON数据结构
        file_path = data.get("filePath", "unknown")
        file_name = data.get("fileName", "unknown")
        file_type = data.get("fileType", "unknown")
        
        if not file_path or file_path == "unknown":
            logger.warning(f"JSON数据缺少filePath字段: {data.keys()}")
            return searchable_items
        
        # 构建文件级别的搜索内容
        file_content_parts = []
        
        # 添加基本文件信息
        file_content_parts.append(f"文件路径: {file_path}")
        file_content_parts.append(f"文件名: {file_name}")
        file_content_parts.append(f"文件类型: {file_type}")
        
        # 添加总行数信息
        total_lines = data.get("totalLines", 0)
        if total_lines > 0:
            file_content_parts.append(f"总行数: {total_lines}")
        
        # 处理导入信息
        imports = data.get("imports", [])
        if imports:
            import_modules = []
            for imp in imports:
                if isinstance(imp, dict):
                    module = imp.get("module", imp.get("source", ""))
                else:
                    module = str(imp)
                if module:
                    import_modules.append(module)
            if import_modules:
                file_content_parts.append(f"导入模块: {', '.join(import_modules[:10])}")  # 限制显示前10个
        
        # 处理导出信息
        exports = data.get("exports", [])
        if exports:
            export_info = []
            for exp in exports:
                if isinstance(exp, dict):
                    exp_type = exp.get("type", "default")
                    exp_name = exp.get("name", "")
                    if exp_name:
                        export_info.append(f"{exp_type}:{exp_name}")
                    else:
                        export_info.append(exp_type)
            if export_info:
                file_content_parts.append(f"导出: {', '.join(export_info)}")
        
        # 处理组件信息
        components = data.get("components", [])
        if components:
            component_names = []
            for comp in components:
                if isinstance(comp, dict):
                    comp_name = comp.get("name", "")
                else:
                    comp_name = str(comp)
                if comp_name:
                    component_names.append(comp_name)
            if component_names:
                file_content_parts.append(f"组件: {', '.join(component_names[:5])}")  # 限制显示前5个
        
        # 处理函数信息
        functions = data.get("functions", [])
        if functions:
            function_names = []
            for func in functions:
                if isinstance(func, dict):
                    func_name = func.get("name", "")
                else:
                    func_name = str(func)
                if func_name:
                    function_names.append(func_name)
            if function_names:
                file_content_parts.append(f"函数: {', '.join(function_names[:5])}")  # 限制显示前5个
        
        # 添加部分文件内容（如果内容不太长）
        content = data.get("content", "")
        if content:
            # 只取前500个字符作为内容摘要
            content_preview = content[:500]
            if len(content) > 500:
                content_preview += "..."
            file_content_parts.append(f"内容摘要: {content_preview}")
        
        # 处理依赖信息
        dependencies = data.get("dependencies", [])
        if dependencies:
            dep_names = []
            for dep in dependencies:
                if isinstance(dep, dict):
                    dep_name = dep.get("name", dep.get("module", ""))
                else:
                    dep_name = str(dep)
                if dep_name:
                    dep_names.append(dep_name)
            if dep_names:
                file_content_parts.append(f"依赖: {', '.join(dep_names[:5])}")  # 限制显示前5个
        
        file_content = "\n".join(file_content_parts)
        
        # 构建元数据
        metadata = {
            "filePath": file_path,
            "fileName": file_name,
            "fileType": file_type,
            "totalLines": total_lines,
            "content_type": "file_analysis",
            "has_imports": len(imports) > 0,
            "has_exports": len(exports) > 0,
            "has_components": len(components) > 0,
            "has_functions": len(functions) > 0,
            "has_dependencies": len(dependencies) > 0,
            "import_count": len(imports),
            "export_count": len(exports),
            "component_count": len(components),
            "function_count": len(functions),
            "dependency_count": len(dependencies)
        }
        
        searchable_items.append((file_content, metadata))
        
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