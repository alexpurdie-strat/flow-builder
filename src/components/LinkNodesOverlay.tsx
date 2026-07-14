import { useFlowStore } from '../store'
import { useReactFlow, useInternalNode } from '@xyflow/react'

type InternalNode = NonNullable<ReturnType<typeof useInternalNode>>

type Port = {
  x: number
  y: number
  handleId: string
}

function getNodePorts(node: InternalNode): Port[] {
  const w = node.measured?.width ?? 160
  const h = node.measured?.height ?? 60
  const ax = node.internals.positionAbsolute.x
  const ay = node.internals.positionAbsolute.y

  return [
    { x: ax + w / 2, y: ay, handleId: 'top' },
    { x: ax + w / 2, y: ay + h, handleId: 'bottom' },
    { x: ax, y: ay + h / 2, handleId: 'left' },
    { x: ax + w, y: ay + h / 2, handleId: 'right' },
  ] as Port[]
}

function dist(a: Port, b: Port) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function getOptimalPorts(aNode: InternalNode, bNode: InternalNode) {
  const aPorts = getNodePorts(aNode)
  const bPorts = getNodePorts(bNode)

  let best = { a: aPorts[0], b: bPorts[0], d: Infinity }
  for (const ap of aPorts) {
    for (const bp of bPorts) {
      const d = dist(ap, bp)
      if (d < best.d) best = { a: ap, b: bp, d }
    }
  }

  return best
}

export default function LinkNodesOverlay() {
  const selectedNodes = useFlowStore((s) => s.selectedNodes)
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const linkSelectedNodes = useFlowStore((s) => s.linkSelectedNodes)
  const { flowToScreenPosition, getZoom } = useReactFlow()

  const selectedSteps = selectedNodes.filter((id) => {
    const node = nodes.find((n) => n.id === id)
    return node?.type === 'step' || node?.type === 'group'
  })

  const nodeA = useInternalNode(selectedSteps[0] ?? '')
  const nodeB = useInternalNode(selectedSteps[1] ?? '')

  if (selectedSteps.length !== 2) return null
  if (!nodeA || !nodeB) return null

  const alreadyLinked = edges.some(
    (e) =>
      (e.source === selectedSteps[0] && e.target === selectedSteps[1]) ||
      (e.source === selectedSteps[1] && e.target === selectedSteps[0])
  )
  if (alreadyLinked) return null

  const best = getOptimalPorts(nodeA, nodeB)

  const zoom = getZoom()
  const screenStart = flowToScreenPosition({ x: best.a.x, y: best.a.y })
  const screenEnd = flowToScreenPosition({ x: best.b.x, y: best.b.y })

  const midX = (screenStart.x + screenEnd.x) / 2
  const midY = (screenStart.y + screenEnd.y) / 2

  const handleOffset: Record<string, { dx: number; dy: number }> = {
    top: { dx: 0, dy: -1 },
    bottom: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
  }

  const curvature = Math.max(60, best.d * 0.4) * zoom
  const startDir = handleOffset[best.a.handleId]
  const endDir = handleOffset[best.b.handleId]

  const cp1x = screenStart.x + startDir.dx * curvature
  const cp1y = screenStart.y + startDir.dy * curvature
  const cp2x = screenEnd.x + endDir.dx * curvature
  const cp2y = screenEnd.y + endDir.dy * curvature

  const allX = [screenStart.x, screenEnd.x, cp1x, cp2x]
  const allY = [screenStart.y, screenEnd.y, cp1y, cp2y]
  const pad = 20
  const svgLeft = Math.min(...allX) - pad
  const svgTop = Math.min(...allY) - pad
  const svgWidth = Math.max(...allX) - svgLeft + pad * 2
  const svgHeight = Math.max(...allY) - svgTop + pad * 2

  const lx = (v: number) => v - svgLeft
  const ly = (v: number) => v - svgTop

  const pathD = `M ${lx(screenStart.x)} ${ly(screenStart.y)} C ${lx(cp1x)} ${ly(cp1y)}, ${lx(cp2x)} ${ly(cp2y)}, ${lx(screenEnd.x)} ${ly(screenEnd.y)}`

  const sourceHandleId = `${best.a.handleId}-source`
  const targetHandleId = `${best.b.handleId}-target`

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{
          position: 'absolute',
          left: svgLeft,
          top: svgTop,
          overflow: 'visible',
        }}
      >
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2 * Math.min(zoom, 1)}
          strokeDasharray="6 4"
          opacity={0.6}
        />
        <circle
          cx={lx(screenStart.x)}
          cy={ly(screenStart.y)}
          r={4 * Math.min(zoom, 1)}
          fill="var(--color-accent)"
          opacity={0.8}
        />
        <circle
          cx={lx(screenEnd.x)}
          cy={ly(screenEnd.y)}
          r={4 * Math.min(zoom, 1)}
          fill="var(--color-accent)"
          opacity={0.8}
        />
      </svg>

      <button
        className="pointer-events-auto absolute flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
        style={{
          left: midX,
          top: midY,
          transform: 'translate(-50%, -50%)',
          background: 'var(--color-accent)',
          color: 'var(--color-canvas)',
          boxShadow: '0 4px 16px rgba(83, 194, 139, 0.35)',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={() => linkSelectedNodes(sourceHandleId, targetHandleId)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Link nodes
      </button>
    </div>
  )
}
