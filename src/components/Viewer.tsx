import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react'
import StepNode from '../nodes/StepNode'
import GroupNode from '../nodes/GroupNode'
import TextNode from '../nodes/TextNode'
import LineNode from '../nodes/LineNode'
import ShapeNode from '../nodes/ShapeNode'
import FlowEdge from '../edges/FlowEdge'

const nodeTypes = {
  step: StepNode,
  group: GroupNode,
  text: TextNode,
  line: LineNode,
  shape: ShapeNode,
}

const edgeTypes = {
  default: FlowEdge,
}

const ZOOM_LEVEL_2 = 0.9
const ZOOM_LEVEL_3 = 0.5

function applyZoomLevels(baseNodes: Node[], baseEdges: Edge[], zoom: number) {
  const level2 = zoom < ZOOM_LEVEL_2
  const level3 = zoom < ZOOM_LEVEL_3

  const groupsWithChildGroups = new Set<string>()
  for (const n of baseNodes) {
    if (n.type === 'group' && n.parentId) {
      groupsWithChildGroups.add(n.parentId)
    }
  }

  const hiddenNodeIds = new Set<string>()

  const nodes = baseNodes.map((node) => {
    if (node.type === 'group') {
      const isNested = !!node.parentId
      const hasChildGroups = groupsWithChildGroups.has(node.id)

      if (isNested && level3) {
        hiddenNodeIds.add(node.id)
        return { ...node, hidden: true, data: { ...node.data, collapsed: true } }
      }

      const shouldCollapse = level3 || (level2 && !hasChildGroups)
      return { ...node, hidden: false, data: { ...node.data, collapsed: shouldCollapse } }
    }

    if (node.parentId || (node.data as Record<string, unknown>).groupId) {
      if (level2) hiddenNodeIds.add(node.id)
      return { ...node, hidden: level2 }
    }
    return node
  })

  const edges = baseEdges.map((edge) => ({
    ...edge,
    hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
  }))

  return { nodes, edges }
}

function parseFlowData(data: { nodes: Node[]; edges: Edge[] }) {
  const nodes = data.nodes.map((n: Node) => ({
    ...n,
    hidden: false,
    data: { ...n.data, collapsed: false },
  }))
  const edges = data.edges.map((e: Edge) => ({ ...e, hidden: false }))
  return { nodes, edges }
}

function ViewerInner({ blobId }: { blobId: string }) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const baseRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })

  useEffect(() => {
    fetch(`https://bytebin.lucko.me/${blobId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((data) => {
        if (!data.nodes || !data.edges) throw new Error('Invalid')
        const el = document.documentElement
        if (data.theme) {
          el.setAttribute('data-theme', data.theme)
        }
        if (data.accent) {
          el.style.setProperty('--color-accent', data.accent)
          if (data.accentHover) el.style.setProperty('--color-accent-hover', data.accentHover)
          const hex = data.accent
          const r = parseInt(hex.slice(1, 3), 16)
          const g = parseInt(hex.slice(3, 5), 16)
          const b = parseInt(hex.slice(5, 7), 16)
          el.style.setProperty('--color-group-bg', `rgba(${r}, ${g}, ${b}, 0.06)`)
          el.style.setProperty('--color-group-border', `rgba(${r}, ${g}, ${b}, 0.25)`)
          el.style.setProperty('--color-group-collapsed-bg', `rgba(${r}, ${g}, ${b}, 0.12)`)
        }
        const parsed = parseFlowData(data)
        baseRef.current = parsed
        setNodes(parsed.nodes)
        setEdges(parsed.edges)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [blobId])

  const onMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: { zoom: number }) => {
      const { nodes: updated, edges: updatedEdges } = applyZoomLevels(
        baseRef.current.nodes,
        baseRef.current.edges,
        viewport.zoom
      )
      baseRef.current = { nodes: updated, edges: updatedEdges }
      setNodes(updated)
      setEdges(updatedEdges)
    },
    []
  )

  if (status === 'loading') {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-canvas)' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading flow...</div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-canvas)' }}>
        <div className="text-center" style={{ color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Failed to load flow</div>
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>The share link may be invalid or expired.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative" style={{ background: 'var(--color-canvas)' }}>
      <div
        className="fixed top-3 left-3 z-10 px-2.5 py-1 rounded-md"
        style={{
          fontSize: 10,
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        View only
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        onMove={onMove}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        panOnDrag
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap position="top-right" pannable zoomable style={{ marginTop: 8 }} />
      </ReactFlow>
    </div>
  )
}

export default function Viewer({ blobId }: { blobId: string }) {
  return (
    <ReactFlowProvider>
      <ViewerInner blobId={blobId} />
    </ReactFlowProvider>
  )
}
