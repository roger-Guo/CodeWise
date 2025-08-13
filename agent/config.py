"""
Agent服务配置文件
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List, Dict, Any

class Settings(BaseSettings):
    """Agent服务设置"""
    
    # 服务配置
    app_name: str = "CodeWise Agent Service"
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 8001
    
    # 项目路径配置
    project_root: Path = Path(__file__).parent.parent
    
    # RAG服务配置
    rag_service_url: str = "http://127.0.0.1:8000"
    rag_api_base: str = "http://127.0.0.1:8000/api/v1"
    
    # Ollama配置
    ollama_base_url: str = "http://localhost:11434"
    llm_model_name: str = "deepseek-coder-v2"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 4096
    
    # LangGraph工作流配置
    max_iterations: int = 10
    max_context_length: int = 16000
    similarity_threshold: float = 0.7
    
    # 检索配置
    initial_search_top_k: int = 5
    dependency_search_top_k: int = 3
    max_dependencies_per_file: int = 5
    
    # 上下文管理
    max_visited_files: int = 20
    context_window_size: int = 8000
    
    # 调用链配置
    max_call_chain_depth: int = 8
    track_backward_references: bool = True
    track_forward_references: bool = True
    
    # 分析类型配置
    analysis_types: List[str] = [
        "function_analysis",    # 函数分析
        "component_analysis",   # 组件分析
        "dependency_tracking",  # 依赖追踪
        "impact_analysis",      # 影响分析
        "call_chain_analysis"   # 调用链分析
    ]
    
    # 缓存配置
    enable_caching: bool = True
    cache_ttl: int = 3600  # 1小时
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

# 全局设置实例
settings = Settings()