import { useState, useEffect } from 'react'
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

function parseFlowData(data: { nodes: Node[]; edges: Edge[] }) {
  const nodes = data.nodes.map((n: Node) => {
    if (n.type === 'group' && (n.data as Record<string, unknown>).collapsed) {
      const { expandedWidth, expandedHeight, ...rest } = n.data as Record<string, unknown>
      const w = (expandedWidth as number) ?? (n.style?.width as number) ?? 400
      const h = (expandedHeight as number) ?? (n.style?.height as number) ?? 300
      return {
        ...n,
        width: w,
        height: h,
        hidden: false,
        data: { ...rest, collapsed: false },
        style: { ...(n.style ?? {}), width: w, height: h },
      }
    }
    return { ...n, hidden: false }
  })
  const edges = data.edges.map((e: Edge) => ({ ...e, hidden: false }))
  return { nodes, edges }
}

function ViewerInner({ blobId }: { blobId: string }) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    fetch(`https://www.toptal.com/developers/hastebin/raw/${blobId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.text().then((t) => JSON.parse(t))
      })
      .then((data) => {
        if (!data.nodes || !data.edges) throw new Error('Invalid')
        const parsed = parseFlowData(data)
        setNodes(parsed.nodes)
        setEdges(parsed.edges)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [blobId])

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
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
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
