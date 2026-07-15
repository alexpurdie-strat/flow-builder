import { useFlowStore, type TextStyle } from '../store'

const TEXT_STYLES: { key: TextStyle; label: string; preview: string }[] = [
  { key: 'header', label: 'Header', preview: 'Aa' },
  { key: 'body', label: 'Body', preview: 'Aa' },
  { key: 'overline', label: 'Overline', preview: 'AA' },
]

export default function TextToolbar() {
  const nodes = useFlowStore((s) => s.nodes)
  const selectedNodes = useFlowStore((s) => s.selectedNodes)
  const updateTextFormat = useFlowStore((s) => s.updateTextFormat)

  const selectedTextNode = nodes.find(
    (n) => n.type === 'text' && selectedNodes.includes(n.id)
  )

  if (!selectedTextNode) return null

  const data = selectedTextNode.data as Record<string, unknown>
  const textStyle = (data.textStyle as TextStyle) ?? 'body'
  const bold = !!data.bold
  const italic = !!data.italic
  const underline = !!data.underline
  const id = selectedTextNode.id

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Text style buttons */}
      {TEXT_STYLES.map((s) => {
        const active = textStyle === s.key
        return (
          <button
            key={s.key}
            onClick={() => updateTextFormat(id, { textStyle: s.key })}
            className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md transition-colors"
            style={{
              background: active ? 'var(--color-accent)' : 'transparent',
              color: active ? 'var(--color-canvas)' : 'var(--color-text)',
              border: 'none',
              cursor: 'pointer',
              minWidth: 44,
            }}
            title={s.label}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span style={{
              fontSize: s.key === 'header' ? 16 : s.key === 'overline' ? 9 : 12,
              fontWeight: s.key === 'header' ? 600 : s.key === 'overline' ? 500 : 400,
              letterSpacing: s.key === 'overline' ? '0.12em' : undefined,
              lineHeight: 1,
            }}>
              {s.preview}
            </span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>{s.label}</span>
          </button>
        )
      })}

      <Sep />

      {/* Bold */}
      <FormatBtn
        active={bold}
        onClick={() => updateTextFormat(id, { bold: !bold })}
        title="Bold"
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>B</span>
      </FormatBtn>

      {/* Italic */}
      <FormatBtn
        active={italic}
        onClick={() => updateTextFormat(id, { italic: !italic })}
        title="Italic"
      >
        <span style={{ fontStyle: 'italic', fontSize: 14, fontFamily: 'Georgia, serif' }}>I</span>
      </FormatBtn>

      {/* Underline */}
      <FormatBtn
        active={underline}
        onClick={() => updateTextFormat(id, { underline: !underline })}
        title="Underline"
      >
        <span style={{ textDecoration: 'underline', fontSize: 14 }}>U</span>
      </FormatBtn>
    </div>
  )
}

function FormatBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-md transition-colors"
      style={{
        width: 30,
        height: 30,
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'var(--color-canvas)' : 'var(--color-text)',
        border: 'none',
        cursor: 'pointer',
      }}
      title={title}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 24, background: 'var(--color-border)', flexShrink: 0 }} />
}
