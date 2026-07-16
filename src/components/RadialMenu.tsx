import { useEffect, useState, useCallback, useRef } from 'react'
import { useFlowStore, type AddMode } from '../store'

const MODES: { key: AddMode; label: string; icon: string }[] = [
  { key: 'cursor', label: 'Select', icon: '↖' },
  { key: 'step', label: 'Step', icon: '⬡' },
  { key: 'group', label: 'Group', icon: '▢' },
  { key: 'text', label: 'Text', icon: 'T' },
  { key: 'line', label: 'Line', icon: '╱' },
]

const OUTER_RADIUS = 100
const INNER_RADIUS = 36
const DEAD_ZONE = 28

function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}


function sectorPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number) {
  const outerStart = polarToCart(cx, cy, outerR, startAngle)
  const outerEnd = polarToCart(cx, cy, outerR, endAngle)
  const innerEnd = polarToCart(cx, cy, innerR, endAngle)
  const innerStart = polarToCart(cx, cy, innerR, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

export default function RadialMenu() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const mousePos = useRef({ x: 0, y: 0 })
  const addMode = useFlowStore((s) => s.addMode)
  const setAddMode = useFlowStore((s) => s.setAddMode)

  useEffect(() => {
    const trackMouse = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', trackMouse)
    return () => window.removeEventListener('mousemove', trackMouse)
  }, [])

  const computeHover = useCallback(
    (mx: number, my: number) => {
      const dx = mx - position.x
      const dy = my - position.y
      const dist = Math.hypot(dx, dy)

      if (dist < DEAD_ZONE) return -1
      if (dist > OUTER_RADIUS + 20) return -1

      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
      if (angle < 0) angle += 360

      const step = 360 / MODES.length
      return Math.floor((angle + step / 2) % 360 / step)
    },
    [position]
  )

  useEffect(() => {
    if (!open) return

    const onMove = (e: MouseEvent) => {
      setHoveredIndex(computeHover(e.clientX, e.clientY))
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [open, computeHover])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !open) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        setPosition({ x: mousePos.current.x, y: mousePos.current.y })
        setOpen(true)
        setHoveredIndex(-1)
      }
    },
    [open]
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' && open) {
        e.preventDefault()
        if (hoveredIndex >= 0) {
          setAddMode(MODES[hoveredIndex].key)
        }
        setOpen(false)
      }
    },
    [open, hoveredIndex, setAddMode]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  if (!open) {
    return (
      <div
        className="fixed bottom-14 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <span style={{ color: 'var(--color-text-muted)' }}>Mode:</span>
        <span
          className="font-semibold capitalize"
          style={{ color: 'var(--color-accent)' }}
        >
          {addMode}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          · hold Space to change
        </span>
      </div>
    )
  }

  const cx = OUTER_RADIUS + 8
  const cy = OUTER_RADIUS + 8
  const size = (OUTER_RADIUS + 8) * 2
  const sliceAngle = 360 / MODES.length
  const gap = 2

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="absolute"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          width: size,
          height: size,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          {/* Outer ring background */}
          <circle
            cx={cx}
            cy={cy}
            r={OUTER_RADIUS}
            fill="none"
            stroke="rgba(51, 65, 85, 0.3)"
            strokeWidth={OUTER_RADIUS - INNER_RADIUS}
            strokeDasharray="none"
          />

          {/* Sector slices */}
          {MODES.map((mode, i) => {
            const startAngle = sliceAngle * i + gap / 2
            const endAngle = sliceAngle * (i + 1) - gap / 2
            const isHovered = hoveredIndex === i
            const isActive = addMode === mode.key

            const midAngle = (startAngle + endAngle) / 2
            const labelR = (OUTER_RADIUS + INNER_RADIUS) / 2
            const labelPos = polarToCart(cx, cy, labelR, midAngle)
            const iconR = labelR + 2
            const iconPos = polarToCart(cx, cy, iconR, midAngle)

            return (
              <g
                key={mode.key}
                onMouseEnter={() => setHoveredIndex(i)}
                onClick={() => {
                  setAddMode(mode.key)
                  setOpen(false)
                }}
              >
                <path
                  d={sectorPath(cx, cy, OUTER_RADIUS, INNER_RADIUS, startAngle, endAngle)}
                  fill={
                    isHovered
                      ? 'rgba(83, 194, 139, 0.9)'
                      : isActive
                      ? 'rgba(15, 52, 96, 0.95)'
                      : 'rgba(22, 33, 62, 0.92)'
                  }
                  stroke={
                    isHovered
                      ? 'var(--color-accent)'
                      : isActive
                      ? 'var(--color-accent)'
                      : 'rgba(51, 65, 85, 0.6)'
                  }
                  strokeWidth={1.5}
                  style={{ transition: 'fill 0.12s, stroke 0.12s' }}
                />

                {/* Icon */}
                <text
                  x={iconPos.x}
                  y={iconPos.y - 6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isHovered ? 'var(--color-canvas)' : 'var(--color-text)'}
                  fontSize={18}
                  fontWeight={500}
                  style={{ pointerEvents: 'none', transition: 'fill 0.12s' }}
                >
                  {mode.icon}
                </text>

                {/* Label */}
                <text
                  x={labelPos.x}
                  y={labelPos.y + 10}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isHovered ? 'var(--color-canvas)' : 'var(--color-text-muted)'}
                  fontSize={9}
                  fontWeight={600}
                  letterSpacing="0.08em"
                  style={{
                    pointerEvents: 'none',
                    transition: 'fill 0.12s',
                  }}
                >
                  {mode.label.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* Divider lines between sectors */}
          {MODES.map((_, i) => {
            const angle = sliceAngle * i
            const inner = polarToCart(cx, cy, INNER_RADIUS - 1, angle)
            const outer = polarToCart(cx, cy, OUTER_RADIUS + 1, angle)
            return (
              <line
                key={`div-${i}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(26, 26, 46, 0.8)"
                strokeWidth={2}
                style={{ pointerEvents: 'none' }}
              />
            )
          })}

          {/* Center circle */}
          <circle
            cx={cx}
            cy={cy}
            r={INNER_RADIUS - 2}
            fill="rgba(22, 33, 62, 0.95)"
            stroke={hoveredIndex >= 0 ? 'var(--color-accent)' : 'rgba(51, 65, 85, 0.6)'}
            strokeWidth={1.5}
            style={{ transition: 'stroke 0.15s' }}
          />

          {/* Center dot / current mode indicator */}
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={hoveredIndex >= 0 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            fontSize={14}
            style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
          >
            {hoveredIndex >= 0 ? MODES[hoveredIndex].icon : MODES.find(m => m.key === addMode)?.icon}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-text-muted)"
            fontSize={7}
            letterSpacing="0.06em"
            style={{ pointerEvents: 'none' }}
          >
            {hoveredIndex >= 0 ? '' : 'CURRENT'}
          </text>
        </svg>
      </div>
    </div>
  )
}
