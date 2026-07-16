import { useFlowStore, type AddMode } from '../store'
import { useRef, useState, useCallback } from 'react'
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng, toJpeg } from 'html-to-image'

type ToolMode = { key: AddMode; label: string; icon: React.ReactNode }

function CursorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <path d="M3 1.5v12.3l3.6-3.5L10 15.5l2.2-1.8-3.6-5.2L13 5z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  )
}

function DottedBoxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2">
      <rect x="2" y="2" width="12" height="12" rx="2" />
    </svg>
  )
}

function LineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="12" x2="12" y2="4" />
    </svg>
  )
}

function DiamondIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="8,2 14,8 8,14 2,8" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 5 13 5" />
      <path d="M5.5 5V3.5a1 1 0 011-1h3a1 1 0 011 1V5" />
      <path d="M12 5v8.5a1 1 0 01-1 1H5a1 1 0 01-1-1V5" />
      <line x1="7" y1="8" x2="7" y2="12" />
      <line x1="9" y1="8" x2="9" y2="12" />
    </svg>
  )
}

const TOOL_MODES: ToolMode[] = [
  { key: 'cursor', label: 'Select', icon: <CursorIcon /> },
  { key: 'step', label: 'Step', icon: <PlusIcon /> },
  { key: 'group', label: 'Group', icon: <DottedBoxIcon /> },
  { key: 'text', label: 'Text', icon: <span style={{ fontSize: 13, fontWeight: 600 }}>T</span> },
  { key: 'line', label: 'Line', icon: <LineIcon /> },
  { key: 'shape', label: 'Shape', icon: <DiamondIcon /> },
]

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200]

type Anchor = 'top' | 'bottom' | 'left' | 'right'

const ANCHOR_STYLES: Record<Anchor, React.CSSProperties> = {
  top: { top: 16, left: '50%', transform: 'translateX(-50%)', flexDirection: 'row' },
  bottom: { bottom: 16, left: '50%', transform: 'translateX(-50%)', flexDirection: 'row' },
  left: { left: 16, top: '50%', transform: 'translateY(-50%)', flexDirection: 'column' },
  right: { right: 16, top: '50%', transform: 'translateY(-50%)', flexDirection: 'column' },
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
  const { zoomTo, fitView } = useReactFlow()

  const [anchor, setAnchor] = useState<Anchor>('top')
  const [dragging, setDragging] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportLevel, setExportLevel] = useState<'detailed' | 'collapsed' | 'overview' | null>(null)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'copied' | 'error' | 'uploading'>('idle')
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const nodes = useFlowStore((s) => s.nodes)

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

  type ExportLevel = 'detailed' | 'collapsed' | 'overview'

  const handleExport = (format: 'png' | 'jpeg', level: ExportLevel) => {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement
    if (!el || nodes.length === 0) return

    const pixelRatio = 3
    const padding = 60

    const visibleNodes = level === 'overview'
      ? nodes.filter((n) => n.type === 'group' || !n.parentId)
      : level === 'collapsed'
        ? nodes.filter((n) => {
            if (n.type === 'group') return true
            if (n.parentId) return false
            return true
          })
        : nodes.filter((n) => !n.hidden)

    const boundsNodes = visibleNodes.length > 0 ? visibleNodes : nodes
    const nodesBounds = getNodesBounds(boundsNodes)

    const imageW = nodesBounds.width + padding * 2
    const imageH = nodesBounds.height + padding * 2
    const viewport = getViewportForBounds(nodesBounds, imageW, imageH, 0.5, 2, padding)

    const opts = {
      width: imageW * pixelRatio,
      height: imageH * pixelRatio,
      style: {
        width: `${imageW}px`,
        height: `${imageH}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
      pixelRatio,
      ...(format === 'jpeg' ? { quality: 0.95 } : {}),
    }

    const fn = format === 'png' ? toPng : toJpeg
    const ext = format === 'png' ? 'png' : 'jpg'

    fn(el, opts).then((dataUrl) => {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `flow-${level}.${ext}`
      a.click()
    })
    setExportOpen(false)
  }

  const handlePublish = useCallback(async () => {
    setPublishStatus('uploading')
    const { nodes, edges } = useFlowStore.getState()

    const downscale = (dataUrl: string, maxW: number): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const ratio = Math.min(maxW / img.width, 1)
          const w = Math.round(img.width * ratio)
          const h = Math.round(img.height * ratio)
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d')!
          ctx.drawImage(img, 0, 0, w, h)
          resolve(c.toDataURL('image/jpeg', 0.5))
        }
        img.onerror = () => resolve(dataUrl)
        img.src = dataUrl
      })

    const thumbNodes = await Promise.all(
      nodes.map(async (n) => {
        const image = (n.data as Record<string, unknown>).image as string | undefined
        if (image && image.startsWith('data:')) {
          const thumb = await downscale(image, 100)
          return { ...n, data: { ...n.data, image: thumb } }
        }
        return n
      })
    )

    try {
      const payload = JSON.stringify({ nodes: thumbNodes, edges })
      const res = await fetch('https://www.toptal.com/developers/hastebin/documents', {
        method: 'POST',
        body: payload,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { key } = await res.json() as { key: string }
      if (!key) throw new Error('No paste key returned')

      const base = window.location.origin + window.location.pathname
      const url = `${base}#/view/${key}`
      await navigator.clipboard.writeText(url)
      setPublishStatus('copied')
      setTimeout(() => setPublishStatus('idle'), 2000)
    } catch (err) {
      console.error('Publish failed:', err)
      setPublishStatus('error')
      setTimeout(() => setPublishStatus('idle'), 3000)
    }
  }, [])

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
      <div
        onMouseDown={handleDragStart}
        className={`flex items-center justify-center shrink-0 rounded ${isVertical ? 'py-1.5 px-0.5' : 'px-0.5 py-1.5'}`}
        style={{ cursor: dragging ? 'grabbing' : 'grab', color: 'var(--color-text-muted)' }}
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
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoad} />

        <Divider vertical={isVertical} />

        {/* Export dropdown */}
        <div className="relative">
          <ToolbarButton onClick={() => { setExportOpen(!exportOpen); setExportLevel(null) }} label="Export" />
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setExportOpen(false); setExportLevel(null) }} />
              <div
                className="absolute z-50 rounded-lg py-2 px-1 mt-1"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: '100%',
                  minWidth: 150,
                }}
              >
                {!exportLevel ? (
                  <>
                    <div className="px-2 pb-1" style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Level
                    </div>
                    <ExportOption label="Detailed" onClick={() => setExportLevel('detailed')} />
                    <ExportOption label="Groups Collapsed" onClick={() => setExportLevel('collapsed')} />
                    <ExportOption label="Overview" onClick={() => setExportLevel('overview')} />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setExportLevel(null)}
                      className="flex items-center gap-1 px-2 pb-1 w-full"
                      style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="5,1 2,4 5,7" /></svg>
                      {exportLevel === 'detailed' ? 'Detailed' : exportLevel === 'collapsed' ? 'Groups Collapsed' : 'Overview'}
                    </button>
                    <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                    <div className="px-2 pb-1" style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Format
                    </div>
                    <ExportOption label="PNG" onClick={() => handleExport('png', exportLevel)} />
                    <ExportOption label="JPEG" onClick={() => handleExport('jpeg', exportLevel)} />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <ToolbarButton
          onClick={handlePublish}
          label={publishStatus === 'copied' ? 'Copied!' : publishStatus === 'error' ? 'Failed' : publishStatus === 'uploading' ? 'Publishing...' : 'Publish'}
        />

        <Divider vertical={isVertical} />

        <ToolbarIconButton onClick={clearAll} title="Clear canvas" danger>
          <TrashIcon />
        </ToolbarIconButton>
      </div>

      <Divider vertical={isVertical} />

      {/* Zoom dropdown */}
      <div className="relative">
        <button
          onClick={() => setZoomOpen(!zoomOpen)}
          className="text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-md"
          style={{
            color: 'var(--color-text-muted)',
            background: zoomOpen ? 'var(--color-surface-2)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            minWidth: 44,
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        {zoomOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setZoomOpen(false)} />
            <div
              className="absolute z-50 rounded-lg py-1 mt-1"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                left: '50%',
                transform: 'translateX(-50%)',
                top: '100%',
                minWidth: 80,
              }}
            >
              {ZOOM_PRESETS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => { zoomTo(pct / 100, { duration: 200 }); setZoomOpen(false) }}
                  className="block w-full text-left text-[11px] px-3 py-1.5"
                  style={{
                    color: Math.round(zoom * 100) === pct ? 'var(--color-accent)' : 'var(--color-text)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: Math.round(zoom * 100) === pct ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {pct}%
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--color-border)', margin: '2px 0' }} />
              <button
                onClick={() => { fitView({ duration: 200 }); setZoomOpen(false) }}
                className="block w-full text-left text-[11px] px-3 py-1.5"
                style={{ color: 'var(--color-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                Fit view
              </button>
            </div>
          </>
        )}
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
  icon: React.ReactNode
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
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <span className="flex items-center justify-center w-[14px] h-[14px]">{icon}</span>
      {!compact && label}
    </button>
  )
}

function ToolbarButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
      style={{
        color: 'var(--color-text)',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.target as HTMLElement).style.background = 'var(--color-surface-2)'
      }}
      onMouseLeave={(e) => {
        ;(e.target as HTMLElement).style.background = 'transparent'
      }}
    >
      {label}
    </button>
  )
}

function ToolbarIconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void
  title: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center p-1.5 rounded-lg transition-colors"
      style={{
        color: danger ? 'var(--color-danger)' : 'var(--color-text)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
      title={title}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function ExportOption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left text-[11px] px-3 py-1.5 rounded-md"
      style={{ color: 'var(--color-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
        ...(vertical ? { width: '100%', height: 1 } : { width: 1, height: 20 }),
      }}
    />
  )
}
