import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { useFlowStore, type ShapeType } from '../store'

function ShapeSvg({ shape, w, h }: { shape: ShapeType; w: number; h: number }) {
  const stroke = 'var(--color-accent)'
  const fill = 'var(--color-accent)'
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
      {shape === 'star' && (() => {
        const cx = w / 2, cy = h / 2
        const or = Math.min(cx, cy) - p
        const ir = or * 0.4
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI / 2 * -1) + (Math.PI / 5) * i
          const r = i % 2 === 0 ? or : ir
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
        }).join(' ')
        return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      })()}
    </svg>
  )
}

const ROTATE_CURSOR = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><path d='M14 3a7 7 0 1 0 1 9' fill='none' stroke='%23666' stroke-width='1.5' stroke-linecap='round'/><polyline points='14,1 14,4 11,4' fill='none' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>") 10 10, crosshair`

function ShapeNode({ id, data, selected }: NodeProps) {
  const { label = '', shape = 'rectangle', rotation = 0 } = data as {
    label?: string; shape?: ShapeType; rotation?: number
  }
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)
  const [rotating, setRotating] = useState(false)
  const [liveSize, setLiveSize] = useState<{ w: number; h: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateLabel = useFlowStore((s) => s.updateNodeLabel)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const nodeRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef(rotation)
  rotationRef.current = rotation

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

  const onRotateStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setRotating(true)

    const rect = nodeRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
    const startRotation = rotationRef.current

    useFlowStore.getState().pushHistory()

    const onMove = (ev: MouseEvent) => {
      const r = nodeRef.current?.getBoundingClientRect()
      if (!r) return
      const ccx = r.left + r.width / 2
      const ccy = r.top + r.height / 2
      const angle = Math.atan2(ev.clientY - ccy, ev.clientX - ccx) * (180 / Math.PI)
      let newRotation = startRotation + (angle - startAngle)
      if (ev.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15
      }
      useFlowStore.setState({
        nodes: useFlowStore.getState().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, rotation: newRotation } } : n
        ),
      })
    }

    const onUp = () => {
      setRotating(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [id])

  const thisNode = useFlowStore((s) => s.nodes.find((n) => n.id === id))
  const w = liveSize?.w ?? (thisNode?.style?.width as number) ?? 120
  const h = liveSize?.h ?? (thisNode?.style?.height as number) ?? 80

  return (
    <div
      ref={nodeRef}
      className="group relative"
      style={{
        width: w,
        height: h,
        cursor: rotating ? ROTATE_CURSOR : 'grab',
      }}
      onDoubleClick={() => {
        setEditLabel(label)
        setEditing(true)
      }}
    >
      <NodeResizer
        minWidth={40}
        minHeight={40}
        isVisible={!!selected}
        lineStyle={{ borderColor: 'var(--color-accent)', borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8, background: 'var(--color-accent)', borderRadius: 2 }}
        onResize={(_e, params) => setLiveSize({ w: params.width, h: params.height })}
        onResizeEnd={() => setLiveSize(null)}
      />

      <div
        style={{
          width: '100%',
          height: '100%',
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          position: 'relative',
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

        <ShapeSvg shape={shape} w={w} h={h} />

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
              className="bg-transparent text-center text-[var(--color-canvas)] font-medium outline-none w-full px-2"
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
              style={{ color: 'var(--color-canvas)', fontSize: 13, lineHeight: '1.2' }}
            >
              {label}
            </div>
          ) : null}
        </div>
      </div>

      {/* Corner rotation zones */}
      {selected && (
        <>
          {[
            { top: -24, left: -24 },
            { top: -24, right: -24 },
            { bottom: -24, left: -24 },
            { bottom: -24, right: -24 },
          ].map((pos, i) => (
            <div
              key={i}
              className="nodrag nopan"
              onMouseDown={onRotateStart}
              style={{
                position: 'absolute',
                width: 20,
                height: 20,
                zIndex: 50,
                cursor: ROTATE_CURSOR,
                ...pos,
              }}
            />
          ))}
        </>
      )}

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
