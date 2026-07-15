import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, type EdgeProps } from '@xyflow/react'
import { useFlowStore, type EndpointStyle } from '../store'

const ENDPOINT_CYCLE: EndpointStyle[] = ['none', 'arrow', 'arrowclosed', 'dot']
const STROKE_WIDTHS = [1, 2, 3, 4]

function getEndAngle(position: Position): number {
  switch (position) {
    case Position.Top: return 90
    case Position.Bottom: return -90
    case Position.Left: return 0
    case Position.Right: return 180
  }
}

function getStartAngle(position: Position): number {
  switch (position) {
    case Position.Top: return -90
    case Position.Bottom: return 90
    case Position.Left: return 180
    case Position.Right: return 0
  }
}

function ArrowMarker({ x, y, angle, filled, color, size }: {
  x: number; y: number; angle: number; filled: boolean; color: string; size: number
}) {
  const hw = size * 0.6
  if (filled) {
    return (
      <polygon
        points={`${-size},${-hw} 0,0 ${-size},${hw}`}
        transform={`translate(${x},${y}) rotate(${angle})`}
        fill={color}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    )
  }
  return (
    <polyline
      points={`${-size},${-hw} 0,0 ${-size},${hw}`}
      transform={`translate(${x},${y}) rotate(${angle})`}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function EndpointIcon({ type, side, active }: { type: EndpointStyle; side: 'start' | 'end'; active: boolean }) {
  const c = active ? 'var(--color-accent)' : 'var(--color-text-muted)'
  const w = 24
  const h = 14
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1={3} y1={h / 2} x2={w - 3} y2={h / 2} stroke={c} strokeWidth={1.5} />
      {type === 'arrow' && side === 'end' && (
        <polyline points={`${w - 9},3 ${w - 3},${h / 2} ${w - 9},${h - 3}`} fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {type === 'arrowclosed' && side === 'end' && (
        <polygon points={`${w - 9},3 ${w - 3},${h / 2} ${w - 9},${h - 3}`} fill={c} stroke={c} strokeWidth={1} strokeLinejoin="round" />
      )}
      {type === 'dot' && side === 'end' && (
        <circle cx={w - 5} cy={h / 2} r={3} fill={c} />
      )}
      {type === 'arrow' && side === 'start' && (
        <polyline points={`9,3 3,${h / 2} 9,${h - 3}`} fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {type === 'arrowclosed' && side === 'start' && (
        <polygon points={`9,3 3,${h / 2} 9,${h - 3}`} fill={c} stroke={c} strokeWidth={1} strokeLinejoin="round" />
      )}
      {type === 'dot' && side === 'start' && (
        <circle cx={5} cy={h / 2} r={3} fill={c} />
      )}
    </svg>
  )
}

function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
  data,
}: EdgeProps) {
  const reverseEdge = useFlowStore((s) => s.reverseEdge)
  const updateEdgeStyle = useFlowStore((s) => s.updateEdgeStyle)

  const strokeWidth = (data?.strokeWidth as number) ?? 2
  const endType = ((data?.endType as string) ?? 'arrowclosed') as EndpointStyle
  const startType = ((data?.startType as string) ?? 'none') as EndpointStyle

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  const markerColor = selected ? 'var(--color-accent)' : 'var(--color-border-hover)'
  const arrowSize = 8

  const endAngle = getEndAngle(targetPosition)
  const startAngle = getStartAngle(sourcePosition)

  const cycleEndpoint = (current: EndpointStyle) => {
    const idx = ENDPOINT_CYCLE.indexOf(current)
    return ENDPOINT_CYCLE[(idx + 1) % ENDPOINT_CYCLE.length]
  }

  const cycleWidth = (current: number) => {
    const idx = STROKE_WIDTHS.indexOf(current)
    return STROKE_WIDTHS[(idx + 1) % STROKE_WIDTHS.length]
  }

  return (
    <>
      <BaseEdge path={edgePath} style={{ ...style, strokeWidth }} />

      {/* Start marker */}
      {startType === 'arrow' && (
        <ArrowMarker x={sourceX} y={sourceY} angle={startAngle} filled={false} color={markerColor} size={arrowSize} />
      )}
      {startType === 'arrowclosed' && (
        <ArrowMarker x={sourceX} y={sourceY} angle={startAngle} filled={true} color={markerColor} size={arrowSize} />
      )}
      {startType === 'dot' && (
        <circle cx={sourceX} cy={sourceY} r={strokeWidth + 2} fill={markerColor} />
      )}

      {/* End marker */}
      {endType === 'arrow' && (
        <ArrowMarker x={targetX} y={targetY} angle={endAngle} filled={false} color={markerColor} size={arrowSize} />
      )}
      {endType === 'arrowclosed' && (
        <ArrowMarker x={targetX} y={targetY} angle={endAngle} filled={true} color={markerColor} size={arrowSize} />
      )}
      {endType === 'dot' && (
        <circle cx={targetX} cy={targetY} r={strokeWidth + 2} fill={markerColor} />
      )}

      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '3px 4px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            {/* Start endpoint */}
            <button
              onClick={(e) => { e.stopPropagation(); updateEdgeStyle(id, { startType: cycleEndpoint(startType) }) }}
              style={btnStyle}
              title={`Start: ${startType}`}
            >
              <EndpointIcon type={startType} side="start" active={startType !== 'none'} />
            </button>

            <Sep />

            {/* Stroke width */}
            <button
              onClick={(e) => { e.stopPropagation(); updateEdgeStyle(id, { strokeWidth: cycleWidth(strokeWidth) }) }}
              style={btnStyle}
              title={`Width: ${strokeWidth}px`}
            >
              <svg width="20" height="14" viewBox="0 0 20 14">
                <line x1="3" y1="7" x2="17" y2="7" stroke="var(--color-text-muted)" strokeWidth={strokeWidth} strokeLinecap="round" />
              </svg>
            </button>

            <Sep />

            {/* End endpoint */}
            <button
              onClick={(e) => { e.stopPropagation(); updateEdgeStyle(id, { endType: cycleEndpoint(endType) }) }}
              style={btnStyle}
              title={`End: ${endType}`}
            >
              <EndpointIcon type={endType} side="end" active={endType !== 'none'} />
            </button>

            <Sep />

            {/* Reverse */}
            <button
              onClick={(e) => { e.stopPropagation(); reverseEdge(id) }}
              style={btnStyle}
              title="Reverse direction"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 8 5 4 5 12" />
                <polyline points="15 8 11 4 11 12" />
                <line x1="5" y1="8" x2="11" y2="8" />
              </svg>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 3px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: 'var(--color-border)', flexShrink: 0 }} />
}

export default memo(FlowEdge)
