import { useFlowStore } from '../store'
import { useReactFlow, useStore as useRFStore } from '@xyflow/react'

export default function LinkNodesOverlay() {
  const selectedNodeIds = useFlowStore((s) => s.selectedNodes)
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const linkSelectedNodes = useFlowStore((s) => s.linkSelectedNodes)
  const { flowToScreenPosition, getZoom } = useReactFlow()

  const internalNodes = useRFStore((s) => s.nodeLookup)

  const linkableIds = selectedNodeIds.filter((id) => {
    const node = nodes.find((n) => n.id === id)
    return node?.type === 'step' || node?.type === 'group'
  })

  if (linkableIds.length < 2) return null

  const [sourceId, ...targetIds] = linkableIds

  const unlinkedTargets = targetIds.filter((tid) => {
    return !edges.some(
      (e) =>
        (e.source === sourceId && e.target === tid) ||
        (e.source === tid && e.target === sourceId)
    )
  })

  if (unlinkedTargets.length === 0) return null

  const sourceInternal = internalNodes.get(sourceId)
  if (!sourceInternal) return null

  const zoom = getZoom()
  const sw = sourceInternal.measured?.width ?? 180
  const sh = sourceInternal.measured?.height ?? 60
  const sx = sourceInternal.internals.positionAbsolute.x
  const sy = sourceInternal.internals.positionAbsolute.y
  const sourceCenter = flowToScreenPosition({ x: sx + sw / 2, y: sy + sh / 2 })

  const previews: { screenStart: { x: number; y: number }; screenEnd: { x: number; y: number }; pathD: string; svgLeft: number; svgTop: number; svgWidth: number; svgHeight: number }[] = []

  for (const tid of unlinkedTargets) {
    const targetInternal = internalNodes.get(tid)
    if (!targetInternal) continue

    const tw = targetInternal.measured?.width ?? 180
    const th = targetInternal.measured?.height ?? 60
    const tx = targetInternal.internals.positionAbsolute.x
    const ty = targetInternal.internals.positionAbsolute.y

    const sides = ['top', 'bottom', 'left', 'right'] as const
    const offset = (side: string, w: number, h: number) => {
      switch (side) {
        case 'top': return { x: w / 2, y: 0 }
        case 'bottom': return { x: w / 2, y: h }
        case 'left': return { x: 0, y: h / 2 }
        case 'right': return { x: w, y: h / 2 }
        default: return { x: w / 2, y: h / 2 }
      }
    }
    const handleDir: Record<string, { dx: number; dy: number }> = {
      top: { dx: 0, dy: -1 },
      bottom: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    }

    let bestDist = Infinity
    let bestSA = 'bottom'
    let bestSB = 'top'
    for (const sA of sides) {
      const oA = offset(sA, sw, sh)
      const ax = sx + oA.x
      const ay = sy + oA.y
      for (const sB of sides) {
        const oB = offset(sB, tw, th)
        const bx = tx + oB.x
        const by = ty + oB.y
        const d = Math.hypot(ax - bx, ay - by)
        if (d < bestDist) {
          bestDist = d
          bestSA = sA
          bestSB = sB
        }
      }
    }

    const oA = offset(bestSA, sw, sh)
    const oB = offset(bestSB, tw, th)
    const screenStart = flowToScreenPosition({ x: sx + oA.x, y: sy + oA.y })
    const screenEnd = flowToScreenPosition({ x: tx + oB.x, y: ty + oB.y })

    const curvature = Math.max(60, bestDist * 0.4) * zoom
    const sd = handleDir[bestSA]
    const ed = handleDir[bestSB]
    const cp1x = screenStart.x + sd.dx * curvature
    const cp1y = screenStart.y + sd.dy * curvature
    const cp2x = screenEnd.x + ed.dx * curvature
    const cp2y = screenEnd.y + ed.dy * curvature

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

    previews.push({ screenStart, screenEnd, pathD, svgLeft, svgTop, svgWidth, svgHeight })
  }

  const label = unlinkedTargets.length === 1 ? 'Link nodes' : `Link to ${unlinkedTargets.length} nodes`

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {previews.map((p, i) => (
        <svg
          key={i}
          width={p.svgWidth}
          height={p.svgHeight}
          style={{
            position: 'absolute',
            left: p.svgLeft,
            top: p.svgTop,
            overflow: 'visible',
          }}
        >
          <path
            d={p.pathD}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2 * Math.min(zoom, 1)}
            strokeDasharray="6 4"
            opacity={0.6}
          />
          <circle
            cx={p.screenStart.x - p.svgLeft}
            cy={p.screenStart.y - p.svgTop}
            r={4 * Math.min(zoom, 1)}
            fill="var(--color-accent)"
            opacity={0.8}
          />
          <circle
            cx={p.screenEnd.x - p.svgLeft}
            cy={p.screenEnd.y - p.svgTop}
            r={4 * Math.min(zoom, 1)}
            fill="var(--color-accent)"
            opacity={0.8}
          />
        </svg>
      ))}

      <button
        className="pointer-events-auto absolute flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
        style={{
          left: sourceCenter.x,
          top: sourceCenter.y - 40,
          transform: 'translate(-50%, -50%)',
          background: 'var(--color-accent)',
          color: 'var(--color-canvas)',
          boxShadow: '0 4px 16px rgba(83, 194, 139, 0.35)',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={() => linkSelectedNodes()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {label}
      </button>
    </div>
  )
}
