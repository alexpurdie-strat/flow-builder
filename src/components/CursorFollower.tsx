import { useEffect, useState } from 'react'
import { useFlowStore } from '../store'

export default function CursorFollower() {
  const [pos, setPos] = useState({ x: -100, y: -100 })
  const [visible, setVisible] = useState(false)
  const addMode = useFlowStore((s) => s.addMode)
  const lineStartNodeId = useFlowStore((s) => s.lineStartNodeId)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY })

      const target = e.target as HTMLElement
      const isPane = target.closest('.react-flow__pane') || target.closest('.react-flow__renderer')
      setVisible(!!isPane)
    }

    const onLeave = () => setVisible(false)

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  if (!visible || addMode === 'cursor') return null

  const label = addMode === 'line' && lineStartNodeId ? 'click target' : addMode
  const icon = addMode === 'line' ? '╱' : '+'

  return (
    <div
      className="fixed z-[90] pointer-events-none flex items-center gap-1.5"
      style={{
        left: pos.x + 16,
        top: pos.y + 16,
      }}
    >
      <span
        className="font-semibold"
        style={{
          color: 'var(--color-accent)',
          fontSize: 18,
          lineHeight: 1,
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}
      >
        {icon}
      </span>
      <span
        className="uppercase font-semibold"
        style={{
          color: 'var(--color-accent)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}
      >
        {label}
      </span>
    </div>
  )
}
