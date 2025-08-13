"""
RAG服务配置文件
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """RAG服务设置"""
    
    # 服务配置
    app_name: str = "CodeWise RAG Service"
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 8000
    
    # 项目路径配置
    project_root: Path = Path(__file__).parent.parent
    parser_output_dir: Path = project_root / "parser" / "output"
    chroma_db_path: Path = project_root / "db"
    models_dir: Path = project_root / "models"
    
    # 嵌入模型配置
    embedding_model_name: str = "BAAI/bge-m3"
    embedding_model_path: Path = models_dir / "bge-m3"
    embedding_dimension: int = 1024
    max_seq_length: int = 8192
    
    # ChromaDB配置
    chroma_collection_name: str = "codewise_knowledge_graph"
    chroma_distance_function: str = "cosine"
    
    # 数据处理配置
    batch_size: int = 32
    chunk_size: int = 1000
    chunk_overlap: int = 200
    
    # 搜索配置
    default_top_k: int = 10
    similarity_threshold: float = 0.7
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

# 全局设置实例
settings = Settings()

# 确保必要目录存在
for directory in [settings.chroma_db_path, settings.models_dir]:
    directory.mkdir(parents=True, exist_ok=True)