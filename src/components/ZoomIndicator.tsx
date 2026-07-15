import { useFlowStore } from '../store'

export default function ZoomIndicator() {
  const zoom = useFlowStore((s) => s.zoom)

  const level = zoom >= 0.9 ? 1 : zoom >= 0.5 ? 2 : 3
  const labels = {
    1: 'Detailed view — zoom out to collapse groups',
    2: 'Groups collapsed — nested groups visible',
    3: 'Overview — only top-level groups shown',
  }
  const colors = {
    1: 'var(--color-text-muted)',
    2: 'var(--color-accent)',
    3: 'var(--color-accent)',
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3].map((l) => (
          <div
            key={l}
            className="w-2 h-2 rounded-full"
            style={{
              background: l <= level ? colors[level as 1 | 2 | 3] : 'var(--color-border)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      <span style={{ color: 'var(--color-text-muted)' }}>
        {labels[level]}
      </span>
    </div>
  )
}
