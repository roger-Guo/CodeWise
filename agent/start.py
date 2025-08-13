#!/usr/bin/env python3
"""
Agent服务启动脚本
确保在正确的conda环境中运行，并检查依赖服务
"""
import os
import sys
import subprocess
import logging
import asyncio
from pathlib import Path
import httpx

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
        'langgraph',
        'langchain',
        'ollama',
        'httpx'
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

async def check_rag_service():
    """检查RAG服务是否运行"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://127.0.0.1:8000/api/v1/health", timeout=5.0)
            if response.status_code == 200:
                print("✅ RAG服务连接正常")
                return True
            else:
                print(f"⚠️  RAG服务状态异常 (状态码: {response.status_code})")
                return False
    except httpx.RequestError:
        print("❌ RAG服务未运行")
        print("请先启动RAG服务: cd ../rag && python start.py")
        return False

async def check_ollama_service():
    """检查Ollama服务是否运行"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:11434/api/version", timeout=5.0)
            if response.status_code == 200:
                print("✅ Ollama服务连接正常")
                
                # 检查deepseek-coder-v2模型
                models_response = await client.get("http://localhost:11434/api/tags", timeout=10.0)
                if models_response.status_code == 200:
                    models_data = models_response.json()
                    available_models = [model["name"] for model in models_data.get("models", [])]
                    
                    deepseek_available = any("deepseek-coder" in model for model in available_models)
                    if deepseek_available:
                        print("✅ deepseek-coder-v2模型可用")
                        return True
                    else:
                        print("⚠️  deepseek-coder-v2模型未找到")
                        print("可用模型:", ", ".join(available_models))
                        print("请运行: ollama pull deepseek-coder-v2")
                        return False
                
                return True
            else:
                print(f"⚠️  Ollama服务状态异常 (状态码: {response.status_code})")
                return False
    except httpx.RequestError:
        print("❌ Ollama服务未运行")
        print("请先启动Ollama服务: ollama serve")
        return False

async def run_service_checks():
    """运行所有服务检查"""
    print("🔍 检查依赖服务状态...")
    
    rag_ok = await check_rag_service()
    ollama_ok = await check_ollama_service()
    
    if not rag_ok:
        print("\n⚠️  建议先启动RAG服务以获得完整功能")
        response = input("是否继续启动Agent服务? (y/N): ")
        if response.lower() != 'y':
            return False
    
    if not ollama_ok:
        print("\n❌ Ollama服务或模型不可用，Agent服务无法正常工作")
        return False
    
    return True

def main():
    """主启动函数"""
    print("🚀 启动CodeWise Agent服务...")
    
    # 检查conda环境
    if not check_conda_environment():
        sys.exit(1)
    
    print(f"✅ 当前环境: {os.environ.get('CONDA_DEFAULT_ENV')}")
    
    # 检查依赖
    if not check_dependencies():
        sys.exit(1)
    
    print("✅ 依赖检查通过")
    
    # 检查服务依赖
    services_ok = asyncio.run(run_service_checks())
    if not services_ok:
        sys.exit(1)
    
    # 启动服务
    print("🌟 启动Agent服务...")
    print("📖 API文档: http://127.0.0.1:8001/docs")
    print("🔍 服务信息: http://127.0.0.1:8001/info")
    print("❤️  健康检查: http://127.0.0.1:8001/api/v1/health")
    print("🗺️  工作流可视化: http://127.0.0.1:8001/api/v1/workflow-visualization")
    print("\n按 Ctrl+C 停止服务\n")
    
    try:
        # 运行主服务
        import uvicorn
        from main import app
        
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8001,
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