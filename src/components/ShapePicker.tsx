import type React from 'react'
import { useFlowStore, type ShapeType } from '../store'

const SHAPES: { key: ShapeType; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    key: 'rectangle',
    label: 'Rectangle',
    icon: (a) => (
      <svg width="20" height="16" viewBox="0 0 20 16">
        <rect x="1" y="1" width="18" height="14" rx="2" fill="none"
          stroke={a ? 'var(--color-canvas)' : 'currentColor'} strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'rounded',
    label: 'Rounded',
    icon: (a) => (
      <svg width="20" height="16" viewBox="0 0 20 16">
        <rect x="1" y="1" width="18" height="14" rx="7" fill="none"
          stroke={a ? 'var(--color-canvas)' : 'currentColor'} strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'circle',
    label: 'Circle',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7.5" fill="none"
          stroke={a ? 'var(--color-canvas)' : 'currentColor'} strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'diamond',
    label: 'Diamond',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <polygon points="9,1 17,9 9,17 1,9" fill="none"
          stroke={a ? 'var(--color-canvas)' : 'currentColor'} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'triangle',
    label: 'Triangle',
    icon: (a) => (
      <svg width="18" height="18" viewBox="0 0 20 18">
        <polygon points="10,1 19,17 1,17" fill="none"
          stroke={a ? 'var(--color-canvas)' : 'currentColor'} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'star',
    label: 'Star',
    icon: (a) => {
      const c = a ? 'var(--color-canvas)' : 'currentColor'
      const pts = Array.from({ length: 10 }, (_, i) => {
        const angle = -Math.PI / 2 + (Math.PI / 5) * i
        const r = i % 2 === 0 ? 8 : 3.2
        return `${9 + r * Math.cos(angle)},${9 + r * Math.sin(angle)}`
      }).join(' ')
      return (
        <svg width="18" height="18" viewBox="0 0 18 18">
          <polygon points={pts} fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )
    },
  },
]

export default function ShapePicker() {
  const addMode = useFlowStore((s) => s.addMode)
  const selectedShape = useFlowStore((s) => s.selectedShape)
  const setSelectedShape = useFlowStore((s) => s.setSelectedShape)

  if (addMode !== 'shape') return null

  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {SHAPES.map((s) => {
        const active = selectedShape === s.key
        return (
          <button
            key={s.key}
            onClick={() => setSelectedShape(s.key)}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 32,
              height: 28,
              background: active ? 'var(--color-accent)' : 'transparent',
              color: active ? 'var(--color-canvas)' : 'var(--color-text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
            title={s.label}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            {s.icon(active)}
          </button>
        )
      })}
    </div>
  )
}
