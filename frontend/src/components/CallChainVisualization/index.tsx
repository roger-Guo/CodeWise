import React, { useEffect, useRef, useState } from 'react'
import { Card, Empty, Button, Space, Select, Tooltip, Switch } from 'antd'
import { 
  FullscreenOutlined, 
  DownloadOutlined, 
  ZoomInOutlined, 
  ZoomOutOutlined,
  ReloadOutlined 
} from '@ant-design/icons'
import * as d3 from 'd3'
import { CallChainNode } from '@/services/api'
import { useThemeStore } from '@/store/themeStore'
import './index.css'

interface CallChainVisualizationProps {
  callChain: CallChainNode[]
}

interface Node extends d3.SimulationNodeDatum {
  id: string
  name: string
  file_path: string
  type: string
  depth: number
  x?: number
  y?: number
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node
  target: string | Node
}

const CallChainVisualization: React.FC<CallChainVisualizationProps> = ({ callChain }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDarkMode } = useThemeStore()
  
  const [layoutType, setLayoutType] = useState<'force' | 'tree' | 'circular'>('force')
  const [showLabels, setShowLabels] = useState(true)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const getNodeColor = (type: string, depth: number) => {
    const colors: Record<string, string> = {
      function: '#1890ff',
      component: '#52c41a',
      class: '#722ed1',
      variable: '#fa8c16',
      unknown: '#8c8c8c'
    }
    
    const baseColor = colors[type] || colors.unknown
    const opacity = Math.max(0.6, 1 - depth * 0.1)
    
    return d3.color(baseColor)?.copy({ opacity }) || baseColor
  }

  const createNodes = (): Node[] => {
    return callChain.map((item, index) => ({
      id: `${item.name}_${index}`,
      name: item.name,
      file_path: item.file_path,
      type: item.type,
      depth: item.depth
    }))
  }

  const createLinks = (nodes: Node[]): Link[] => {
    const links: Link[] = []
    
    // 根据调用链创建连接
    for (let i = 0; i < nodes.length - 1; i++) {
      links.push({
        source: nodes[i].id,
        target: nodes[i + 1].id
      })
    }
    
    return links
  }

  const renderVisualization = () => {
    if (!svgRef.current || !containerRef.current || callChain.length === 0) return

    const container = containerRef.current
    const svg = d3.select(svgRef.current)
    
    // 清除之前的内容
    svg.selectAll('*').remove()

    const width = container.clientWidth
    const height = Math.max(400, container.clientHeight)
    
    svg.attr('width', width).attr('height', height)

    const nodes = createNodes()
    const links = createLinks(nodes)

    // 创建缩放和拖拽
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom as any)

    // 创建主容器组
    const g = svg.append('g')

    // 创建箭头标记
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', isDarkMode ? '#666' : '#999')
      .style('stroke', 'none')

    let simulation: d3.Simulation<Node, Link>

    // 根据布局类型创建不同的布局
    switch (layoutType) {
      case 'force':
        simulation = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
          .force('charge', d3.forceManyBody().strength(-300))
          .force('center', d3.forceCenter(width / 2, height / 2))
        break
        
      case 'tree':
        // 树形布局
        const root = d3.hierarchy({ children: nodes } as any)
        const treeLayout = d3.tree<any>().size([width - 100, height - 100])
        treeLayout(root)
        
        nodes.forEach((node, index) => {
          if (root.children && root.children[index]) {
            node.x = root.children[index].x + 50
            node.y = root.children[index].y + 50
          }
        })
        
        simulation = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
          .alphaTarget(0)
        break
        
      case 'circular':
        // 圆形布局
        const radius = Math.min(width, height) / 3
        const centerX = width / 2
        const centerY = height / 2
        
        nodes.forEach((node, index) => {
          const angle = (index / nodes.length) * 2 * Math.PI
          node.x = centerX + radius * Math.cos(angle)
          node.y = centerY + radius * Math.sin(angle)
        })
        
        simulation = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(links).id((d: any) => d.id).distance(50))
          .alphaTarget(0)
        break
        
      default:
        simulation = d3.forceSimulation(nodes)
    }

    // 创建连接线
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', isDarkMode ? '#434343' : '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)')

    // 创建节点
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }))

    // 添加节点圆圈
    node.append('circle')
      .attr('r', (d) => 15 + d.depth * 2)
      .attr('fill', (d) => getNodeColor(d.type, d.depth))
      .attr('stroke', isDarkMode ? '#434343' : '#fff')
      .attr('stroke-width', 2)

    // 添加节点文本
    if (showLabels) {
      node.append('text')
        .attr('dx', 20)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', isDarkMode ? '#e6e6e6' : '#333')
        .text((d) => d.name)
    }

    // 节点点击事件
    node.on('click', (event, d) => {
      setSelectedNode(d)
      
      // 高亮选中节点
      node.selectAll('circle')
        .attr('stroke-width', (n: Node) => n.id === d.id ? 4 : 2)
        .attr('stroke', (n: Node) => n.id === d.id ? '#ff4d4f' : (isDarkMode ? '#434343' : '#fff'))
    })

    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    // 添加缩放控制
    const zoomControls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', `translate(${width - 100}, 20)`)

    zoomControls.append('rect')
      .attr('width', 80)
      .attr('height', 80)
      .attr('rx', 8)
      .attr('fill', isDarkMode ? '#262626' : '#f5f5f5')
      .attr('stroke', isDarkMode ? '#434343' : '#d9d9d9')

    const zoomInBtn = zoomControls.append('g')
      .attr('transform', 'translate(10, 10)')
      .style('cursor', 'pointer')

    zoomInBtn.append('rect')
      .attr('width', 25)
      .attr('height', 25)
      .attr('rx', 4)
      .attr('fill', 'transparent')

    zoomInBtn.append('text')
      .attr('x', 12.5)
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', isDarkMode ? '#e6e6e6' : '#333')
      .text('+')

    zoomInBtn.on('click', () => {
      svg.transition().call(zoom.scaleBy as any, 1.2)
    })

    const zoomOutBtn = zoomControls.append('g')
      .attr('transform', 'translate(45, 10)')
      .style('cursor', 'pointer')

    zoomOutBtn.append('rect')
      .attr('width', 25)
      .attr('height', 25)
      .attr('rx', 4)
      .attr('fill', 'transparent')

    zoomOutBtn.append('text')
      .attr('x', 12.5)
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', isDarkMode ? '#e6e6e6' : '#333')
      .text('-')

    zoomOutBtn.on('click', () => {
      svg.transition().call(zoom.scaleBy as any, 0.8)
    })

    const resetBtn = zoomControls.append('g')
      .attr('transform', 'translate(27.5, 45)')
      .style('cursor', 'pointer')

    resetBtn.append('circle')
      .attr('r', 12)
      .attr('fill', 'transparent')

    resetBtn.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .style('font-size', '12px')
      .style('fill', isDarkMode ? '#e6e6e6' : '#333')
      .text('●')

    resetBtn.on('click', () => {
      svg.transition().call(zoom.transform as any, d3.zoomIdentity)
    })
  }

  useEffect(() => {
    renderVisualization()
    
    const handleResize = () => {
      setTimeout(renderVisualization, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [callChain, layoutType, showLabels, isDarkMode])

  const exportSVG = () => {
    if (!svgRef.current) return
    
    const svgElement = svgRef.current
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `call_chain_${Date.now()}.svg`
    a.click()
    
    URL.revokeObjectURL(url)
  }

  if (callChain.length === 0) {
    return (
      <Card className="call-chain-card">
        <Empty
          description="暂无调用链数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    )
  }

  return (
    <div className="call-chain-container">
      {/* 控制面板 */}
      <div className="controls-panel">
        <Space wrap>
          <Select
            value={layoutType}
            onChange={setLayoutType}
            style={{ width: 120 }}
            size="small"
          >
            <Select.Option value="force">力导图</Select.Option>
            <Select.Option value="tree">树形图</Select.Option>
            <Select.Option value="circular">圆形图</Select.Option>
          </Select>
          
          <Space>
            <span style={{ fontSize: '12px', color: '#666' }}>显示标签</span>
            <Switch
              size="small"
              checked={showLabels}
              onChange={setShowLabels}
            />
          </Space>
          
          <Tooltip title="导出SVG">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={exportSVG}
            />
          </Tooltip>
          
          <Tooltip title="重新渲染">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={renderVisualization}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 可视化容器 */}
      <div className="visualization-container" ref={containerRef}>
        <svg ref={svgRef} className="call-chain-svg"></svg>
      </div>

      {/* 节点详情面板 */}
      {selectedNode && (
        <div className="node-details">
          <Card size="small" title="节点详情">
            <div className="node-info">
              <p><strong>名称:</strong> {selectedNode.name}</p>
              <p><strong>类型:</strong> {selectedNode.type}</p>
              <p><strong>文件:</strong> {selectedNode.file_path}</p>
              <p><strong>深度:</strong> {selectedNode.depth}</p>
            </div>
            <Button size="small" onClick={() => setSelectedNode(null)}>
              关闭
            </Button>
          </Card>
        </div>
      )}

      {/* 图例 */}
      <div className="legend">
        <Card size="small" title="图例">
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#1890ff' }}></div>
              <span>函数</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#52c41a' }}></div>
              <span>组件</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#722ed1' }}></div>
              <span>类</span>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: '#fa8c16' }}></div>
              <span>变量</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default CallChainVisualization