import { memo, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useFlowStore } from '../store'

export type LineNodeData = {
  dx: number
  dy: number
}

function LineNode({ id, data, selected }: NodeProps) {
  const { dx, dy } = data as LineNodeData
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const [hover, setHover] = useState(false)

  const pad = 20
  const minX = Math.min(0, dx)
  const minY = Math.min(0, dy)
  const maxX = Math.max(0, dx)
  const maxY = Math.max(0, dy)
  const w = maxX - minX + pad * 2
  const h = maxY - minY + pad * 2

  const x1 = -minX + pad
  const y1 = -minY + pad
  const x2 = dx - minX + pad
  const y2 = dy - minY + pad

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        marginLeft: minX - pad,
        marginTop: minY - pad,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <svg
        width={w}
        height={h}
        style={{ display: 'block' }}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={selected ? 'var(--color-accent)' : 'var(--color-border-hover)'}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Wider hit area */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="transparent"
          strokeWidth={16}
        />
        {/* Endpoints */}
        <circle cx={x1} cy={y1} r={4} fill={selected ? 'var(--color-accent)' : 'var(--color-border-hover)'} />
        <circle cx={x2} cy={y2} r={4} fill={selected ? 'var(--color-accent)' : 'var(--color-border-hover)'} />
      </svg>

      {hover && (
        <button
          className="absolute w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-[10px] leading-none flex items-center justify-center"
          style={{
            top: Math.min(y1, y2) - 12,
            left: (x1 + x2) / 2 - 10,
          }}
          title="Delete line"
          onClick={(e) => {
            e.stopPropagation()
            deleteNode(id)
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export default memo(LineNode)
