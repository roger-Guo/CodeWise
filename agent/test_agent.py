#!/usr/bin/env python3
"""
Agent服务测试脚本
"""
import asyncio
import json
import requests
import httpx
import time
import sys

# 服务基础URL
BASE_URL = "http://127.0.0.1:8001"
API_BASE_URL = f"{BASE_URL}/api/v1"

def test_service_connection():
    """测试服务连接"""
    print("🔗 测试Agent服务连接...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Agent服务连接正常")
            return True
        else:
            print(f"❌ Agent服务连接失败，状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 无法连接到Agent服务: {e}")
        print("请确保Agent服务已启动: python start.py")
        return False

def test_health_check():
    """测试健康检查"""
    print("\n❤️  测试健康检查...")
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print("✅ 健康检查通过")
            print(f"   整体状态: {'健康' if data.get('healthy') else '异常'}")
            
            services = data.get('services', {})
            for service_name, service_data in services.items():
                status = service_data.get('status', 'unknown')
                print(f"   {service_name}: {status}")
            
            return data.get('healthy', False)
        else:
            print(f"❌ 健康检查失败，状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 健康检查出错: {e}")
        return False

def test_service_status():
    """测试服务状态"""
    print("\n📋 测试服务状态...")
    try:
        response = requests.get(f"{API_BASE_URL}/status")
        if response.status_code == 200:
            data = response.json()
            print("✅ 服务状态获取成功")
            print(f"   Agent服务: {data.get('agent_service')}")
            print(f"   RAG服务: {data.get('rag_service')}")
            print(f"   Ollama服务: {data.get('ollama_service')}")
            print(f"   Ollama模型: {data.get('ollama_model')}")
            return True
        else:
            print(f"❌ 获取服务状态失败，状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 获取服务状态出错: {e}")
        return False

def test_workflow_visualization():
    """测试工作流可视化"""
    print("\n🗺️  测试工作流可视化...")
    try:
        response = requests.get(f"{API_BASE_URL}/workflow-visualization")
        if response.status_code == 200:
            data = response.json()
            print("✅ 工作流可视化获取成功")
            
            mermaid_graph = data.get('mermaid_graph', '')
            if mermaid_graph:
                print("   Mermaid图表:")
                print("   " + mermaid_graph.replace('\n', '\n   '))
            
            node_descriptions = data.get('node_descriptions', {})
            if node_descriptions:
                print("   节点描述:")
                for node, desc in node_descriptions.items():
                    print(f"   - {node}: {desc}")
            
            return True
        else:
            print(f"❌ 获取工作流可视化失败，状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 获取工作流可视化出错: {e}")
        return False

def test_code_analysis():
    """测试代码分析功能"""
    print("\n🔍 测试代码分析功能...")
    
    test_queries = [
        {
            "query": "React组件中useState的使用",
            "analysis_type": "component_analysis"
        },
        {
            "query": "查找函数定义和调用关系",
            "analysis_type": "function_analysis"
        },
        {
            "query": "分析模块依赖关系",
            "analysis_type": "dependency_tracking"
        }
    ]
    
    for i, test_case in enumerate(test_queries):
        print(f"\n   测试 {i+1}: {test_case['query']}")
        try:
            payload = {
                "query": test_case["query"],
                "analysis_type": test_case["analysis_type"],
                "max_iterations": 3  # 限制迭代次数以加快测试
            }
            
            start_time = time.time()
            response = requests.post(
                f"{API_BASE_URL}/analyze",
                json=payload,
                timeout=60  # 1分钟超时
            )
            execution_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ 分析成功 (耗时: {execution_time:.2f}s)")
                print(f"   - 迭代次数: {data.get('iteration_count', 0)}")
                print(f"   - 访问文件数: {len(data.get('visited_files', []))}")
                print(f"   - 调用链长度: {len(data.get('call_chain', []))}")
                
                answer = data.get('answer', '')
                if answer:
                    preview = answer[:200] + "..." if len(answer) > 200 else answer
                    print(f"   - 答案预览: {preview}")
                
                errors = data.get('errors', [])
                if errors:
                    print(f"   ⚠️  发现错误: {len(errors)} 个")
                
            else:
                print(f"   ❌ 分析失败，状态码: {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   错误详情: {error_detail}")
                except:
                    print(f"   响应内容: {response.text}")
                    
        except Exception as e:
            print(f"   ❌ 分析出错: {e}")
    
    return True

async def test_streaming_analysis():
    """测试流式分析"""
    print("\n🌊 测试流式分析...")
    
    try:
        payload = {
            "query": "React组件的生命周期",
            "analysis_type": "component_analysis"
        }
        
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{API_BASE_URL}/analyze-stream",
                json=payload,
                timeout=30.0
            ) as response:
                
                if response.status_code == 200:
                    print("   ✅ 流式分析连接成功")
                    
                    update_count = 0
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            try:
                                data = json.loads(line[6:])  # 去掉 "data: " 前缀
                                update_type = data.get("type", "unknown")
                                
                                if update_type == "progress":
                                    print(f"   📊 进度更新: 节点={data.get('current_node')}, 迭代={data.get('iteration')}")
                                elif update_type == "intermediate_result":
                                    print(f"   🔄 中间结果: {data.get('result', {}).get('node', 'unknown')}")
                                elif update_type == "final_result":
                                    print(f"   🎉 最终结果: 成功={data.get('result', {}).get('success', False)}")
                                    break
                                elif update_type == "error":
                                    print(f"   ❌ 错误: {data.get('error')}")
                                    break
                                
                                update_count += 1
                                if update_count > 10:  # 限制更新数量
                                    print("   ⏹️  达到更新限制，停止接收")
                                    break
                                    
                            except json.JSONDecodeError:
                                continue
                    
                    print("   ✅ 流式分析测试完成")
                    return True
                else:
                    print(f"   ❌ 流式分析失败，状态码: {response.status_code}")
                    return False
                    
    except Exception as e:
        print(f"   ❌ 流式分析出错: {e}")
        return False

def test_batch_analysis():
    """测试批量分析"""
    print("\n📦 测试批量分析...")
    
    try:
        payload = {
            "queries": [
                "React Hook使用",
                "函数组件定义",
                "模块导入导出"
            ],
            "analysis_type": "general",
            "parallel": True
        }
        
        start_time = time.time()
        response = requests.post(
            f"{API_BASE_URL}/batch-analyze",
            json=payload,
            timeout=120  # 2分钟超时
        )
        execution_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ 批量分析成功 (耗时: {execution_time:.2f}s)")
            print(f"   - 总查询数: {data.get('total_queries', 0)}")
            print(f"   - 成功分析: {data.get('successful_analyses', 0)}")
            print(f"   - 失败分析: {data.get('failed_analyses', 0)}")
            
            results = data.get('results', [])
            for i, result in enumerate(results[:2]):  # 只显示前2个结果
                success = result.get('success', False)
                query = result.get('query', '')
                print(f"   - 查询{i+1} '{query}': {'成功' if success else '失败'}")
            
            return True
        else:
            print(f"   ❌ 批量分析失败，状态码: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ 批量分析出错: {e}")
        return False

def main():
    """主测试函数"""
    print("🧪 CodeWise Agent服务测试")
    print("=" * 50)
    
    # 基础连接测试
    if not test_service_connection():
        return
    
    # 健康检查
    if not test_health_check():
        print("⚠️  健康检查失败，但继续测试其他功能...")
    
    # 服务状态
    test_service_status()
    
    # 工作流可视化
    test_workflow_visualization()
    
    # 代码分析测试
    test_code_analysis()
    
    # 流式分析测试
    print("\n开始流式分析测试...")
    asyncio.run(test_streaming_analysis())
    
    # 批量分析测试
    test_batch_analysis()
    
    print("\n" + "=" * 50)
    print("🎉 测试完成！")
    print("💡 提示:")
    print("   - API文档: http://127.0.0.1:8001/docs")
    print("   - 健康检查: http://127.0.0.1:8001/api/v1/health")
    print("   - 工作流图表: http://127.0.0.1:8001/api/v1/workflow-visualization")

if __name__ == "__main__":
    main()