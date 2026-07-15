import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useFlowStore, type ShapeType } from '../store'

function ShapeSvg({ shape, selected, w, h }: { shape: ShapeType; selected: boolean; w: number; h: number }) {
  const stroke = selected ? 'var(--color-accent)' : 'var(--color-border)'
  const fill = 'var(--color-surface)'
  const sw = 2
  const p = sw / 2

  return (
    <svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {shape === 'rectangle' && (
        <rect x={p} y={p} width={w - sw} height={h - sw} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />
      )}
      {shape === 'rounded' && (
        <rect x={p} y={p} width={w - sw} height={h - sw} rx={14} fill={fill} stroke={stroke} strokeWidth={sw} />
      )}
      {shape === 'circle' && (
        <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - p} ry={h / 2 - p} fill={fill} stroke={stroke} strokeWidth={sw} />
      )}
      {shape === 'diamond' && (
        <polygon
          points={`${w / 2},${p} ${w - p},${h / 2} ${w / 2},${h - p} ${p},${h / 2}`}
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
        />
      )}
      {shape === 'triangle' && (
        <polygon
          points={`${w / 2},${p} ${w - p},${h - p} ${p},${h - p}`}
          fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

function ShapeNode({ id, data, selected }: NodeProps) {
  const { label = '', shape = 'rectangle' } = data as { label?: string; shape?: ShapeType }
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateLabel = useFlowStore((s) => s.updateNodeLabel)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const nodeRef = useRef<HTMLDivElement>(null)

  const save = useCallback(() => {
    updateLabel(id, editLabel)
    setEditing(false)
  }, [id, editLabel, updateLabel])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    if (!editing) return
    const handler = (e: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) save()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [editing, save])

  const w = 120
  const h = 80

  return (
    <div
      ref={nodeRef}
      className="group relative"
      style={{
        width: w,
        height: h,
        cursor: 'grab',
        boxShadow: selected ? '0 0 0 3px rgba(83, 194, 139, 0.15)' : 'none',
        borderRadius: 4,
      }}
      onDoubleClick={() => {
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

      <ShapeSvg shape={shape} selected={!!selected} w={w} h={h} />

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="bg-transparent text-center text-[var(--color-text)] font-medium outline-none w-full px-2"
            style={{ fontSize: 13 }}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : label ? (
          <div
            className="text-center font-medium px-2 overflow-hidden text-ellipsis"
            style={{ color: 'var(--color-text)', fontSize: 13, lineHeight: '1.2' }}
          >
            {label}
          </div>
        ) : null}
      </div>

      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ zIndex: 2 }}
        onClick={(e) => {
          e.stopPropagation()
          deleteNode(id)
        }}
      >
        ×
      </button>
    </div>
  )
}

export default memo(ShapeNode)
