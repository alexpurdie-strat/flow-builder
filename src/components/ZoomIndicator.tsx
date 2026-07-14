import { useFlowStore } from '../store'

export default function ZoomIndicator() {
  const zoom = useFlowStore((s) => s.zoom)
  const isCollapsed = zoom < 0.5

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: isCollapsed ? 'var(--color-accent)' : 'var(--color-text-muted)',
          transition: 'background 0.2s',
        }}
      />
      <span style={{ color: 'var(--color-text-muted)' }}>
        {isCollapsed ? 'Collapsed view — zoom in to expand groups' : 'Detailed view — zoom out to collapse groups'}
      </span>
    </div>
  )
}
