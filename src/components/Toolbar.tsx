import { useFlowStore, type AddMode } from '../store'
import { useRef, useState, useCallback } from 'react'

const TOOL_MODES: { key: AddMode; label: string; icon: string }[] = [
  { key: 'cursor', label: 'Select', icon: '↖' },
  { key: 'step', label: 'Step', icon: '⬡' },
  { key: 'group', label: 'Group', icon: '▢' },
  { key: 'text', label: 'Text', icon: 'T' },
  { key: 'line', label: 'Line', icon: '╱' },
]

type Anchor = 'top' | 'bottom' | 'left' | 'right'

const ANCHOR_STYLES: Record<Anchor, React.CSSProperties> = {
  top: {
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    flexDirection: 'row',
  },
  bottom: {
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    flexDirection: 'row',
  },
  left: {
    left: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    flexDirection: 'column',
  },
  right: {
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    flexDirection: 'column',
  },
}

function DragDots() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" style={{ opacity: 0.4 }}>
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="6" cy="2" r="1.5" />
      <circle cx="2" cy="7" r="1.5" />
      <circle cx="6" cy="7" r="1.5" />
      <circle cx="2" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
    </svg>
  )
}

export default function Toolbar() {
  const addMode = useFlowStore((s) => s.addMode)
  const setAddMode = useFlowStore((s) => s.setAddMode)
  const groupSelectedNodes = useFlowStore((s) => s.groupSelectedNodes)
  const selectedNodes = useFlowStore((s) => s.selectedNodes)
  const saveToJSON = useFlowStore((s) => s.saveToJSON)
  const loadFromJSON = useFlowStore((s) => s.loadFromJSON)
  const clearAll = useFlowStore((s) => s.clearAll)
  const zoom = useFlowStore((s) => s.zoom)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [anchor, setAnchor] = useState<Anchor>('top')
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = ev.clientX - window.innerWidth / 2
      const dy = ev.clientY - window.innerHeight / 2
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      let newAnchor: Anchor
      if (absDx > absDy) {
        newAnchor = dx < 0 ? 'left' : 'right'
      } else {
        newAnchor = dy < 0 ? 'top' : 'bottom'
      }
      setAnchor(newAnchor)
    }

    const onUp = () => {
      dragStartRef.current = null
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleSave = () => {
    const json = saveToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flow.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadFromJSON(reader.result)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const isVertical = anchor === 'left' || anchor === 'right'

  return (
    <div
      className="fixed z-50 flex items-center gap-1 px-3 py-2 rounded-xl"
      style={{
        ...ANCHOR_STYLES[anchor],
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        transition: dragging ? 'none' : 'all 0.25s ease',
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        className={`flex items-center justify-center shrink-0 rounded ${isVertical ? 'py-1.5 px-0.5' : 'px-0.5 py-1.5'}`}
        style={{
          cursor: dragging ? 'grabbing' : 'grab',
          color: 'var(--color-text-muted)',
        }}
        title="Drag to reposition toolbar"
      >
        <DragDots />
      </div>

      <Divider vertical={isVertical} />

      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} items-center gap-1`}>
        {TOOL_MODES.map((mode) => (
          <ToolModeButton
            key={mode.key}
            icon={mode.icon}
            label={mode.label}
            active={addMode === mode.key}
            onClick={() => setAddMode(mode.key)}
            compact={isVertical}
          />
        ))}
      </div>

      <Divider vertical={isVertical} />

      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} items-center gap-1`}>
        <ToolbarButton
          onClick={groupSelectedNodes}
          label="Group Selection"
          disabled={selectedNodes.length < 2}
        />

        <Divider vertical={isVertical} />

        <ToolbarButton onClick={handleSave} label="Save" />
        <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Load" />
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleLoad}
        />

        <Divider vertical={isVertical} />

        <ToolbarButton onClick={clearAll} label="Clear" danger />
      </div>

      <Divider vertical={isVertical} />

      <div
        className="text-[10px] uppercase tracking-[0.1em] px-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}

function ToolModeButton({
  icon,
  label,
  active,
  onClick,
  compact,
}: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
      style={{
        color: active ? 'var(--color-canvas)' : 'var(--color-text)',
        background: active ? 'var(--color-accent)' : 'transparent',
        border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
        cursor: 'pointer',
      }}
      title={label}
      onMouseEnter={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }
      }}
    >
      <span className="text-sm leading-none">{icon}</span>
      {!compact && label}
    </button>
  )
}

function ToolbarButton({
  onClick,
  label,
  disabled,
  danger,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
      style={{
        color: danger ? 'var(--color-danger)' : 'var(--color-text)',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          ;(e.target as HTMLElement).style.background = 'var(--color-surface-2)'
        }
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.background = 'transparent'
      }}
    >
      {label}
    </button>
  )
}

function Divider({ vertical }: { vertical?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-border)',
        ...(vertical
          ? { width: '100%', height: 1 }
          : { width: 1, height: 20 }),
      }}
    />
  )
}
