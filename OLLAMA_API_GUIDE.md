# Ollama API 使用指南

## 🚀 Ollama服务状态

- **服务地址**: `http://localhost:11434`
- **已安装模型**: `deepseek-coder-v2:latest`
- **模型大小**: 8.9GB
- **参数规模**: 15.7B
- **量化级别**: Q4_0

## 📡 API端点概览

### 1. 模型管理API

#### 列出所有模型
```bash
curl http://localhost:11434/api/tags
```

#### 拉取模型
```bash
curl -X POST http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "deepseek-coder-v2"}'
```

#### 删除模型
```bash
curl -X DELETE http://localhost:11434/api/delete \
  -H "Content-Type: application/json" \
  -d '{"name": "deepseek-coder-v2"}'
```

### 2. 聊天API

#### 基础聊天请求
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-coder-v2",
    "messages": [
      {
        "role": "user",
        "content": "你好，请介绍一下你自己"
      }
    ],
    "stream": false
  }'
```

#### 流式聊天请求
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-coder-v2",
    "messages": [
      {
        "role": "user",
        "content": "写一个Python函数来计算斐波那契数列"
      }
    ],
    "stream": true
  }'
```

### 3. 生成API

#### 单次生成
```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-coder-v2",
    "prompt": "写一个JavaScript函数来反转字符串",
    "stream": false
  }'
```

## 🐍 Python客户端示例

### 基础Python客户端
```python
import requests
import json

class OllamaClient:
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url
    
    def list_models(self):
        """列出所有可用模型"""
        response = requests.get(f"{self.base_url}/api/tags")
        return response.json()
    
    def chat(self, model, messages, stream=False):
        """发送聊天请求"""
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream
        }
        response = requests.post(
            f"{self.base_url}/api/chat",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        return response.json()
    
    def generate(self, model, prompt, stream=False):
        """发送生成请求"""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream
        }
        response = requests.post(
            f"{self.base_url}/api/generate",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        return response.json()

# 使用示例
client = OllamaClient()

# 列出模型
models = client.list_models()
print("可用模型:", models)

# 聊天示例
response = client.chat(
    model="deepseek-coder-v2",
    messages=[
        {"role": "user", "content": "写一个Python函数来计算阶乘"}
    ]
)
print("回复:", response["message"]["content"])
```

### 流式处理示例
```python
import requests
import json

def stream_chat(model, messages):
    """流式聊天处理"""
    payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }
    
    response = requests.post(
        "http://localhost:11434/api/chat",
        headers={"Content-Type": "application/json"},
        json=payload,
        stream=True
    )
    
    for line in response.iter_lines():
        if line:
            data = json.loads(line.decode('utf-8'))
            if 'message' in data:
                content = data['message']['content']
                print(content, end='', flush=True)
            if data.get('done', False):
                break

# 使用示例
stream_chat(
    "deepseek-coder-v2",
    [{"role": "user", "content": "解释什么是递归"}]
)
```

## 🔧 高级配置

### 模型参数配置
```bash
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-coder-v2",
    "messages": [
      {
        "role": "user",
        "content": "写一个排序算法"
      }
    ],
    "options": {
      "temperature": 0.7,
      "top_p": 0.9,
      "top_k": 40,
      "num_predict": 1000,
      "stop": ["\n\n", "```"]
    }
  }'
```

### 参数说明
- **temperature**: 控制随机性 (0.0-1.0)
- **top_p**: 核采样参数 (0.0-1.0)
- **top_k**: 保留前k个token
- **num_predict**: 最大生成token数
- **stop**: 停止生成的标记

## 🛠️ 在CodeWise项目中的集成

### 创建Ollama服务模块
```python
# rag/ollama_service.py
import requests
import json
from typing import List, Dict, Optional
from loguru import logger

class OllamaService:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.model = "deepseek-coder-v2"
    
    def health_check(self) -> bool:
        """检查Ollama服务状态"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama服务检查失败: {e}")
            return False
    
    def generate_code_explanation(self, code: str, context: str = "") -> str:
        """生成代码解释"""
        prompt = f"""
请分析以下代码并给出详细解释：

代码：
```python
{code}
```

上下文：{context}

请从以下几个方面进行分析：
1. 代码功能
2. 实现逻辑
3. 关键部分说明
4. 可能的改进建议
"""
        
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                headers={"Content-Type": "application/json"},
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 2000
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()["response"]
            else:
                logger.error(f"Ollama API请求失败: {response.status_code}")
                return "代码分析服务暂时不可用"
                
        except Exception as e:
            logger.error(f"调用Ollama服务失败: {e}")
            return "代码分析服务暂时不可用"
    
    def answer_code_question(self, question: str, code_context: str = "") -> str:
        """回答代码相关问题"""
        messages = [
            {
                "role": "system",
                "content": "你是一个专业的代码分析助手，擅长分析代码结构、解释实现逻辑、提供改进建议。"
            },
            {
                "role": "user",
                "content": f"问题：{question}\n\n相关代码：{code_context}"
            }
        ]
        
        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                headers={"Content-Type": "application/json"},
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.4,
                        "num_predict": 1500
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()["message"]["content"]
            else:
                logger.error(f"Ollama聊天API请求失败: {response.status_code}")
                return "问答服务暂时不可用"
                
        except Exception as e:
            logger.error(f"调用Ollama聊天服务失败: {e}")
            return "问答服务暂时不可用"

# 使用示例
if __name__ == "__main__":
    ollama = OllamaService()
    
    # 检查服务状态
    if ollama.health_check():
        print("✅ Ollama服务正常运行")
        
        # 测试代码解释
        test_code = """
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
"""
        explanation = ollama.generate_code_explanation(test_code)
        print("代码解释:", explanation)
    else:
        print("❌ Ollama服务不可用")
```

## 🚀 快速测试

### 测试服务状态
```bash
# 检查模型列表
curl http://localhost:11434/api/tags

# 测试简单对话
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-coder-v2",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

## 📝 注意事项

1. **服务启动**: 确保Ollama服务在后台运行
2. **模型加载**: 首次使用模型时可能需要一些时间加载
3. **内存使用**: 大模型会占用较多内存
4. **网络访问**: 默认只监听localhost，如需外部访问需要配置
5. **错误处理**: 建议在代码中添加适当的错误处理和重试机制

## 🔗 相关资源

- [Ollama官方文档](https://ollama.ai/docs)
- [Ollama API参考](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [模型库](https://ollama.ai/library)
