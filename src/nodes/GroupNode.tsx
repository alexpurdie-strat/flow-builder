import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react'
import { useFlowStore } from '../store'

function GroupNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const { label, collapsed } = data as { label: string; collapsed?: boolean }
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateLabel = useFlowStore((s) => s.updateNodeLabel)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const ungroupNode = useFlowStore((s) => s.ungroupNode)
  const absorbStepsIntoGroup = useFlowStore((s) => s.absorbStepsIntoGroup)
  const nodes = useFlowStore((s) => s.nodes)
  const zoom = useFlowStore((s) => s.zoom)
  const setZoom = useFlowStore((s) => s.setZoom)
  const { setViewport } = useReactFlow()

  const onResizeEnd = useCallback(() => {
    absorbStepsIntoGroup(id)
  }, [id, absorbStepsIntoGroup])

  const childCount = nodes.filter((n) => n.parentId === id).length

  const scale = Math.max(1, 1 / zoom)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = () => {
    updateLabel(id, editLabel || 'Process Group')
    setEditing(false)
  }

  const thisNode = nodes.find((n) => n.id === id)
  const expandedW = (thisNode?.data as Record<string, unknown>)?.expandedWidth as number | undefined
  const expandedH = (thisNode?.data as Record<string, unknown>)?.expandedHeight as number | undefined
  const groupW = expandedW ?? (thisNode?.style?.width as number) ?? 400
  const groupH = expandedH ?? (thisNode?.style?.height as number) ?? 300

  const handleCollapsedClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const targetZoom = 1.0
    const cx = positionAbsoluteX + groupW / 2
    const cy = positionAbsoluteY + groupH / 2
    const vx = window.innerWidth / 2 - cx * targetZoom
    const vy = window.innerHeight / 2 - cy * targetZoom
    setViewport({ x: vx, y: vy, zoom: targetZoom }, { duration: 400 })
    setTimeout(() => setZoom(targetZoom), 420)
  }, [positionAbsoluteX, positionAbsoluteY, groupW, groupH, setViewport, setZoom])

  const handleCollapsedDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const padding = 80
    const zoomX = (window.innerWidth - padding * 2) / groupW
    const zoomY = (window.innerHeight - padding * 2) / groupH
    const targetZoom = Math.min(zoomX, zoomY, 2)
    const cx = positionAbsoluteX + groupW / 2
    const cy = positionAbsoluteY + groupH / 2
    const vx = window.innerWidth / 2 - cx * targetZoom
    const vy = window.innerHeight / 2 - cy * targetZoom
    setViewport({ x: vx, y: vy, zoom: targetZoom }, { duration: 400 })
    setTimeout(() => setZoom(targetZoom), 420)
  }, [positionAbsoluteX, positionAbsoluteY, groupW, groupH, setViewport, setZoom])

  if (collapsed) {
    return (
      <div
        onClick={handleCollapsedClick}
        onDoubleClick={handleCollapsedDoubleClick}
        style={{
          background: 'var(--color-group-collapsed-bg)',
          border: `2px solid var(--color-group-border)`,
          borderRadius: 14,
          padding: `${20 * scale}px ${28 * scale}px`,
          minWidth: 180 * scale,
          textAlign: 'center',
          cursor: 'pointer',
          boxShadow: selected ? '0 0 0 3px rgba(83, 194, 139, 0.2)' : 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
        <div
          className="font-semibold mb-1"
          style={{
            color: 'var(--color-accent)',
            fontSize: `${16 * scale}px`,
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
        <div
          className="uppercase"
          style={{
            color: 'var(--color-text-muted)',
            fontSize: `${11 * scale}px`,
            letterSpacing: '0.1em',
          }}
        >
          {childCount} step{childCount !== 1 ? 's' : ''} · click to open
        </div>
      </div>
    )
  }

  return (
    <div
      className="group relative"
      style={{
        background: 'transparent',
        border: `2px dashed ${selected ? 'var(--color-accent)' : 'var(--color-group-border)'}`,
        borderRadius: 14,
        width: '100%',
        height: '100%',
        minWidth: 200,
        minHeight: 100,
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditLabel(label)
        setEditing(true)
      }}
    >
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
      <Handle type="target" position={Position.Right} id="right-target" />

      <NodeResizer
        minWidth={200}
        minHeight={100}
        isVisible={selected}
        lineStyle={{ borderColor: 'var(--color-accent)', borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8, background: 'var(--color-accent)', borderRadius: 2 }}
        onResizeEnd={onResizeEnd}
      />
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: '1px dashed var(--color-group-border)' }}
      >
        {editing ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="bg-transparent border-b border-[var(--color-accent)] text-[var(--color-accent)] font-semibold outline-none"
              style={{ fontSize: `${14 * scale}px` }}
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') setEditing(false)
              }}
              onBlur={save}
            />
          </div>
        ) : (
          <>
            <span
              className="font-semibold"
              style={{
                color: 'var(--color-accent)',
                fontSize: `${14 * scale}px`,
              }}
            >
              {label}
            </span>
            <span
              className="uppercase"
              style={{
                color: 'var(--color-text-muted)',
                fontSize: `${10 * scale}px`,
                letterSpacing: '0.1em',
              }}
            >
              {childCount} step{childCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>

      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="w-5 h-5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-[10px] leading-none flex items-center justify-center"
          title="Ungroup"
          onClick={(e) => {
            e.stopPropagation()
            ungroupNode(id)
          }}
        >
          ⊟
        </button>
        <button
          className="w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-[10px] leading-none flex items-center justify-center"
          title="Delete group"
          onClick={(e) => {
            e.stopPropagation()
            deleteNode(id)
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default memo(GroupNode)
