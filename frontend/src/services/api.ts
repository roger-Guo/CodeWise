import axios from 'axios'

// 创建axios实例
const api = axios.create({
  timeout: 60000, // 60秒超时
  headers: {
    'Content-Type': 'application/json',
  },
})

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API请求错误:', error)
    throw error
  }
)

// 类型定义
export interface AnalysisRequest {
  query: string
  analysis_type?: 'general' | 'function_analysis' | 'component_analysis' | 'dependency_tracking' | 'impact_analysis' | 'call_chain_analysis'
  max_iterations?: number
  config?: Record<string, any>
}

export interface CallChainNode {
  name: string
  file_path: string
  type: string
  depth: number
}

export interface AnalysisResponse {
  success: boolean
  query: string
  analysis_type: string
  answer: string
  execution_time?: number
  iteration_count: number
  visited_files: string[]
  call_chain: CallChainNode[]
  context_summary: string
  errors: string[]
  warnings: string[]
  intermediate_results: any[]
}

export interface ServiceHealthResponse {
  healthy: boolean
  services: Record<string, any>
  version: string
}

export interface ServiceStatusResponse {
  status: string
  agent_service: string
  rag_service: string
  ollama_service: string
  ollama_model: string
  timestamp: string
}

export interface BatchAnalysisRequest {
  queries: string[]
  analysis_type?: string
  parallel?: boolean
}

export interface DependencyAnalysisRequest {
  target: string
  depth?: number
  include_backward?: boolean
  include_forward?: boolean
}

// Agent服务API
export const agentApi = {
  // 代码分析
  analyze: (data: AnalysisRequest): Promise<AnalysisResponse> => 
    api.post('/api/v1/analyze', data),

  // 流式分析
  analyzeStream: (data: AnalysisRequest) => {
    return fetch('/api/v1/analyze-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  },

  // 批量分析
  batchAnalyze: (data: BatchAnalysisRequest) =>
    api.post('/api/v1/batch-analyze', data),

  // 依赖分析
  dependencyAnalysis: (data: DependencyAnalysisRequest) =>
    api.post('/api/v1/dependency-analysis', data),

  // 工作流可视化
  getWorkflowVisualization: () =>
    api.get('/api/v1/workflow-visualization'),
}

// 服务状态API
export const getServiceHealth = (): Promise<ServiceHealthResponse> =>
  api.get('/api/v1/health')

export const getServiceStatus = (): Promise<ServiceStatusResponse> =>
  api.get('/api/v1/status')

// RAG服务API
export const ragApi = {
  // 搜索代码
  search: (data: {
    query: string
    top_k?: number
    filter_metadata?: Record<string, any>
    include_content?: boolean
  }) => api.post('/rag-api/search', data),

  // 获取文档
  getDocument: (docId: string) =>
    api.get(`/rag-api/document/${docId}`),

  // 数据库统计
  getStats: () =>
    api.get('/rag-api/stats'),

  // 加载数据
  loadData: (data: { reload?: boolean; batch_size?: number }) =>
    api.post('/rag-api/load-data', data),
}

export default api