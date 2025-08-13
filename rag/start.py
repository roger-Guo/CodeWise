#!/usr/bin/env python3
"""
RAG服务启动脚本
确保在正确的conda环境中运行
"""
import os
import sys
import subprocess
import logging
from pathlib import Path

def check_conda_environment():
    """检查是否在正确的conda环境中"""
    conda_env = os.environ.get('CONDA_DEFAULT_ENV')
    if conda_env != 'codewise':
        print("❌ 错误: 未激活codewise虚拟环境")
        print("请先运行: conda activate codewise")
        return False
    return True

def check_dependencies():
    """检查关键依赖是否安装"""
    required_packages = [
        'fastapi',
        'uvicorn', 
        'chromadb',
        'sentence_transformers',
        'torch'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ 缺少依赖包: {', '.join(missing_packages)}")
        print("请运行: pip install -r requirements.txt")
        return False
    
    return True

def ensure_directories():
    """确保必要的目录存在"""
    project_root = Path(__file__).parent.parent
    required_dirs = [
        project_root / "db",
        project_root / "models", 
        project_root / "parser" / "output"
    ]
    
    for dir_path in required_dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"✅ 目录确认: {dir_path}")

def main():
    """主启动函数"""
    print("🚀 启动CodeWise RAG服务...")
    
    # 检查conda环境
    if not check_conda_environment():
        sys.exit(1)
    
    print(f"✅ 当前环境: {os.environ.get('CONDA_DEFAULT_ENV')}")
    
    # 检查依赖
    if not check_dependencies():
        sys.exit(1)
    
    print("✅ 依赖检查通过")
    
    # 确保目录存在
    ensure_directories()
    
    # 启动服务
    print("🌟 启动FastAPI服务...")
    print("📖 API文档: http://127.0.0.1:8000/docs")
    print("🔍 服务信息: http://127.0.0.1:8000/info")
    print("❤️  健康检查: http://127.0.0.1:8000/api/v1/health")
    print("\n按 Ctrl+C 停止服务\n")
    
    try:
        # 运行主服务
        import uvicorn
        from main import app
        
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n👋 服务已停止")
    except Exception as e:
        print(f"❌ 服务启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()