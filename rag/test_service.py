#!/usr/bin/env python3
"""
RAG服务测试脚本
"""
import asyncio
import json
import requests
import time
import sys
import os
from pathlib import Path

# 服务基础URL
BASE_URL = "http://127.0.0.1:8000"
API_BASE_URL = f"{BASE_URL}/api/v1"

def test_service_connection():
    """测试服务连接"""
    print("🔗 测试服务连接...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ 服务连接正常")
            return True
        else:
            print(f"❌ 服务连接失败，状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 无法连接到服务: {e}")
        print("请确保RAG服务已启动: python start.py")
        return False

def test_health_check():
    """测试健康检查"""
    print("\n❤️  测试健康检查...")
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print("✅ 健康检查通过")
            print(f"   状态: {data.get('status')}")
            print(f"   嵌入模型: {data.get('embedding_model')}")
            print(f"   数据库: {data.get('database')}")
            return True
        else:
            print(f"❌ 健康检查失败，状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 健康检查出错: {e}")
        return False

def test_service_info():
    """测试服务信息"""
    print("\n📋 测试服务信息...")
    try:
        response = requests.get(f"{BASE_URL}/info")
        if response.status_code == 200:
            data = response.json()
            print("✅ 服务信息获取成功")
            print(f"   服务名称: {data.get('service_name')}")
            print(f"   版本: {data.get('version')}")
            print(f"   嵌入模型: {data.get('embedding_model')}")
            print(f"   解析器输出目录: {data.get('parser_output_dir')}")
            return True
        else:
            print(f"❌ 获取服务信息失败，状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 获取服务信息出错: {e}")
        return False

def test_initialize():
    """测试服务初始化"""
    print("\n🚀 测试服务初始化...")
    try:
        response = requests.post(f"{API_BASE_URL}/initialize")
        if response.status_code == 200:
            data = response.json()
            print("✅ 服务初始化成功")
            print(f"   消息: {data.get('message')}")
            print(f"   嵌入模型: {data.get('embedding_model')}")
            print(f"   数据库: {data.get('database')}")
            return True
        else:
            print(f"❌ 服务初始化失败，状态码: {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   错误详情: {error_detail}")
            except:
                print(f"   响应内容: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 服务初始化出错: {e}")
        return False

def test_database_stats():
    """测试数据库统计"""
    print("\n📊 测试数据库统计...")
    try:
        response = requests.get(f"{API_BASE_URL}/stats")
        if response.status_code == 200:
            data = response.json()
            print("✅ 数据库统计获取成功")
            print(f"   集合名称: {data.get('collection_name')}")
            print(f"   文档数量: {data.get('document_count')}")
            print(f"   嵌入模型: {data.get('embedding_model')}")
            return True
        else:
            print(f"❌ 获取数据库统计失败，状态码: {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   错误详情: {error_detail}")
            except:
                print(f"   响应内容: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 获取数据库统计出错: {e}")
        return False

def test_load_data(reload=False):
    """测试数据加载"""
    action = "重新加载" if reload else "加载"
    print(f"\n📥 测试数据{action}...")
    
    try:
        payload = {
            "reload": reload,
            "batch_size": 5
        }
        
        print(f"   请求参数: {payload}")
        response = requests.post(
            f"{API_BASE_URL}/load-data",
            json=payload,
            timeout=300  # 5分钟超时
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 数据{action}成功")
            print(f"   总文件数: {data.get('total_files')}")
            print(f"   成功加载: {data.get('loaded_files')}")
            print(f"   失败文件: {data.get('failed_files')}")
            print(f"   总条目数: {data.get('total_entries')}")
            print(f"   执行时间: {data.get('execution_time'):.2f}秒")
            print(f"   消息: {data.get('message')}")
            return data.get('loaded_files', 0) > 0
        else:
            print(f"❌ 数据{action}失败，状态码: {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   错误详情: {error_detail}")
            except:
                print(f"   响应内容: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 数据{action}出错: {e}")
        return False

def test_search():
    """测试搜索功能"""
    print("\n🔍 测试搜索功能...")
    
    test_queries = [
        "React组件",
        "useState Hook",
        "函数定义",
        "导入模块"
    ]
    
    for query in test_queries:
        print(f"\n   搜索查询: '{query}'")
        try:
            payload = {
                "query": query,
                "top_k": 3,
                "include_content": True
            }
            
            response = requests.post(
                f"{API_BASE_URL}/search",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                results_count = data.get('total', 0)
                print(f"   ✅ 找到 {results_count} 个结果")
                
                if results_count > 0:
                    print(f"   执行时间: {data.get('execution_time', 0):.3f}秒")
                    # 显示第一个结果的摘要
                    first_result = data.get('results', [])[0]
                    if first_result:
                        print(f"   最相关结果:")
                        print(f"   - ID: {first_result.get('id')}")
                        print(f"   - 相似度: {first_result.get('similarity_score', 0):.3f}")
                        metadata = first_result.get('metadata', {})
                        file_path = metadata.get('filePath', 'unknown')
                        print(f"   - 文件: {file_path}")
                else:
                    print("   ⚠️  未找到匹配结果")
                    
            else:
                print(f"   ❌ 搜索失败，状态码: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 搜索出错: {e}")
    
    return True

def check_parser_output():
    """检查解析器输出是否存在"""
    print("\n📁 检查解析器输出...")
    
    parser_output_dir = Path(__file__).parent.parent / "parser" / "output"
    
    if not parser_output_dir.exists():
        print(f"❌ 解析器输出目录不存在: {parser_output_dir}")
        print("请先运行解析器生成数据:")
        print("   cd parser && node test.js")
        return False
    
    json_files = list(parser_output_dir.rglob("*.json"))
    json_files = [f for f in json_files if f.name != "project-summary.json"]
    
    if not json_files:
        print("❌ 未找到解析器输出的JSON文件")
        print("请先运行解析器生成数据:")
        print("   cd parser && node test.js")
        return False
    
    print(f"✅ 找到 {len(json_files)} 个JSON文件")
    print(f"   输出目录: {parser_output_dir}")
    
    return True

def main():
    """主测试函数"""
    print("🧪 CodeWise RAG服务测试")
    print("=" * 50)
    
    # 基础连接测试
    if not test_service_connection():
        return
    
    # 健康检查
    if not test_health_check():
        return
    
    # 服务信息
    test_service_info()
    
    # 服务初始化
    if not test_initialize():
        print("⚠️  服务初始化失败，可能是首次运行或模型未下载")
        print("这不影响其他功能测试，继续...")
    
    # 数据库统计
    test_database_stats()
    
    # 检查解析器输出
    has_parser_data = check_parser_output()
    
    if has_parser_data:
        # 数据加载测试
        if test_load_data(reload=False):
            # 重新检查数据库统计
            print("\n📊 加载后数据库统计...")
            test_database_stats()
            
            # 搜索测试
            test_search()
        else:
            print("⚠️  数据加载失败，跳过搜索测试")
    else:
        print("⚠️  跳过数据加载和搜索测试（缺少解析器数据）")
    
    print("\n" + "=" * 50)
    print("🎉 测试完成！")
    print("💡 提示:")
    print("   - 如需重新加载数据: curl -X POST 'http://127.0.0.1:8000/api/v1/load-data' -H 'Content-Type: application/json' -d '{\"reload\": true}'")
    print("   - API文档: http://127.0.0.1:8000/docs")
    print("   - 健康检查: http://127.0.0.1:8000/api/v1/health")

if __name__ == "__main__":
    main()