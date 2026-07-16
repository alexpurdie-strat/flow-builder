import { useMemo } from 'react'
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
import { decompressFromEncodedURIComponent } from 'lz-string'
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

function ViewerInner({ compressed }: { compressed: string }) {
  const { nodes, edges, error } = useMemo(() => {
    try {
      const json = decompressFromEncodedURIComponent(compressed)
      if (!json) return { nodes: [] as Node[], edges: [] as Edge[], error: 'Failed to decompress data' }
      const data = JSON.parse(json)
      if (!data.nodes || !data.edges) return { nodes: [] as Node[], edges: [] as Edge[], error: 'Invalid flow data' }
      const nodes = (data.nodes as Node[]).map((n: Node) => {
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
      const edges = (data.edges as Edge[]).map((e: Edge) => ({ ...e, hidden: false }))
      return { nodes, edges, error: null }
    } catch {
      return { nodes: [] as Node[], edges: [] as Edge[], error: 'Failed to parse flow data' }
    }
  }, [compressed])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-canvas)' }}>
        <div className="text-center" style={{ color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{error}</div>
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>The share link may be invalid or corrupted.</div>
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

export default function Viewer({ compressed }: { compressed: string }) {
  return (
    <ReactFlowProvider>
      <ViewerInner compressed={compressed} />
    </ReactFlowProvider>
  )
}
