import type { ReactNode } from 'react'
import { useFlowStore } from '../store'
import { useReactFlow } from '@xyflow/react'

type AlignAction = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v' | 'grid'

const ACTIONS: { key: AlignAction; label: string; icon: ReactNode }[] = [
  {
    key: 'left',
    label: 'Align left',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="2" x2="2" y2="14" />
        <rect x="4" y="3" width="10" height="3" rx="0.5" />
        <rect x="4" y="9" width="6" height="3" rx="0.5" />
      </svg>
    ),
  },
  {
    key: 'center-h',
    label: 'Center horizontal',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="8" y1="1" x2="8" y2="15" strokeDasharray="2 2" />
        <rect x="3" y="3" width="10" height="3" rx="0.5" />
        <rect x="5" y="9" width="6" height="3" rx="0.5" />
      </svg>
    ),
  },
  {
    key: 'right',
    label: 'Align right',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="14" y1="2" x2="14" y2="14" />
        <rect x="2" y="3" width="10" height="3" rx="0.5" />
        <rect x="6" y="9" width="6" height="3" rx="0.5" />
      </svg>
    ),
  },
  {
    key: 'top',
    label: 'Align top',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="2" x2="14" y2="2" />
        <rect x="3" y="4" width="3" height="10" rx="0.5" />
        <rect x="9" y="4" width="3" height="6" rx="0.5" />
      </svg>
    ),
  },
  {
    key: 'center-v',
    label: 'Center vertical',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="1" y1="8" x2="15" y2="8" strokeDasharray="2 2" />
        <rect x="3" y="3" width="3" height="10" rx="0.5" />
        <rect x="9" y="5" width="3" height="6" rx="0.5" />
      </svg>
    ),
  },
  {
    key: 'bottom',
    label: 'Align bottom',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="2" y1="14" x2="14" y2="14" />
        <rect x="3" y="2" width="3" height="10" rx="0.5" />
        <rect x="9" y="6" width="3" height="6" rx="0.5" />
      </svg>
    ),
  },
  {
    key: 'grid',
    label: 'Tidy up to grid',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="4" height="4" rx="0.5" />
        <rect x="10" y="2" width="4" height="4" rx="0.5" />
        <rect x="2" y="10" width="4" height="4" rx="0.5" />
        <rect x="10" y="10" width="4" height="4" rx="0.5" />
      </svg>
    ),
  },
]

export default function AlignToolbar() {
  const selectedNodeIds = useFlowStore((s) => s.selectedNodes)
  const nodes = useFlowStore((s) => s.nodes)
  const pushHistory = useFlowStore((s) => s.pushHistory)
  const { flowToScreenPosition } = useReactFlow()

  if (selectedNodeIds.length < 2) return null

  const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
  if (selected.length < 2) return null

  const getDims = (n: typeof selected[0]) => ({
    w: (n.style?.width as number) ?? (n.measured?.width as number) ?? 180,
    h: (n.style?.height as number) ?? (n.measured?.height as number) ?? 60,
  })

  const avgX = selected.reduce((sum, n) => sum + n.position.x + getDims(n).w / 2, 0) / selected.length
  const minY = Math.min(...selected.map((n) => n.position.y))
  const screenPos = flowToScreenPosition({ x: avgX, y: minY - 50 })

  const align = (action: AlignAction) => {
    pushHistory()

    const positions = selected.map((n) => {
      const d = getDims(n)
      return { id: n.id, x: n.position.x, y: n.position.y, w: d.w, h: d.h }
    })

    let updates: Record<string, { x: number; y: number }> = {}

    switch (action) {
      case 'left': {
        const minX = Math.min(...positions.map((p) => p.x))
        updates = Object.fromEntries(positions.map((p) => [p.id, { x: minX, y: p.y }]))
        break
      }
      case 'right': {
        const maxRight = Math.max(...positions.map((p) => p.x + p.w))
        updates = Object.fromEntries(positions.map((p) => [p.id, { x: maxRight - p.w, y: p.y }]))
        break
      }
      case 'top': {
        const minY = Math.min(...positions.map((p) => p.y))
        updates = Object.fromEntries(positions.map((p) => [p.id, { x: p.x, y: minY }]))
        break
      }
      case 'bottom': {
        const maxBottom = Math.max(...positions.map((p) => p.y + p.h))
        updates = Object.fromEntries(positions.map((p) => [p.id, { x: p.x, y: maxBottom - p.h }]))
        break
      }
      case 'center-h': {
        const centerX = (Math.min(...positions.map((p) => p.x)) + Math.max(...positions.map((p) => p.x + p.w))) / 2
        updates = Object.fromEntries(positions.map((p) => [p.id, { x: centerX - p.w / 2, y: p.y }]))
        break
      }
      case 'center-v': {
        const centerY = (Math.min(...positions.map((p) => p.y)) + Math.max(...positions.map((p) => p.y + p.h))) / 2
        updates = Object.fromEntries(positions.map((p) => [p.id, { x: p.x, y: centerY - p.h / 2 }]))
        break
      }
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(positions.length))
        const gap = 20
        const sorted = [...positions].sort((a, b) => a.y - b.y || a.x - b.x)
        const baseX = Math.min(...sorted.map((p) => p.x))
        const baseY = Math.min(...sorted.map((p) => p.y))
        const cellW = Math.max(...sorted.map((p) => p.w)) + gap
        const cellH = Math.max(...sorted.map((p) => p.h)) + gap

        const snapTo20 = (v: number) => Math.round(v / 20) * 20

        updates = Object.fromEntries(
          sorted.map((p, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            return [p.id, { x: snapTo20(baseX + col * cellW), y: snapTo20(baseY + row * cellH) }]
          })
        )
        break
      }
    }

    useFlowStore.setState({
      nodes: nodes.map((n) => {
        if (updates[n.id]) {
          return { ...n, position: updates[n.id] }
        }
        return n
      }),
    })
  }

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 px-2 py-1.5 rounded-lg"
      style={{
        left: Math.max(8, Math.min(screenPos.x, window.innerWidth - 280)),
        top: Math.max(70, screenPos.y),
        transform: 'translateX(-50%)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {ACTIONS.map((action, i) => (
        <span key={action.key} className="contents">
          {i === 3 && <Separator />}
          <button
            onClick={() => align(action.key)}
            title={action.label}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{
              color: 'var(--color-text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--color-accent)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
            }}
          >
            {action.icon}
          </button>
        </span>
      ))}
    </div>
  )
}

function Separator() {
  return (
    <div
      className="w-px h-5 mx-0.5"
      style={{ background: 'var(--color-border)' }}
    />
  )
}
