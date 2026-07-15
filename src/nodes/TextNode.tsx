import { memo, useState, useRef, useEffect } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useFlowStore, type TextStyle } from '../store'

type TextData = {
  label: string
  textStyle?: TextStyle
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

const STYLE_MAP: Record<TextStyle, React.CSSProperties> = {
  header: { fontSize: 24, fontWeight: 600, lineHeight: 1.2 },
  body: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  overline: { fontSize: 11, fontWeight: 500, lineHeight: 1.4, textTransform: 'uppercase', letterSpacing: '0.12em' },
}

function TextNode({ id, data, selected }: NodeProps) {
  const { label, textStyle = 'body', bold, italic, underline } = data as TextData
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const updateLabel = useFlowStore((s) => s.updateNodeLabel)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const zoom = useFlowStore((s) => s.zoom)

  const scale = Math.max(1, 1 / zoom)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = () => {
    updateLabel(id, editLabel || 'Text')
    setEditing(false)
  }

  const baseStyle = STYLE_MAP[textStyle] ?? STYLE_MAP.body
  const textCss: React.CSSProperties = {
    ...baseStyle,
    fontSize: (baseStyle.fontSize as number) * scale,
    fontWeight: bold ? 700 : baseStyle.fontWeight,
    fontStyle: italic ? 'italic' : 'normal',
    textDecoration: underline ? 'underline' : 'none',
  }

  return (
    <div
      className="group relative"
      style={{
        padding: `${8 * scale}px ${12 * scale}px`,
        cursor: 'grab',
        maxWidth: 300 * scale,
        borderLeft: '2px solid var(--color-accent)',
        background: selected ? 'rgba(83, 194, 139, 0.05)' : 'transparent',
        borderRadius: '0 4px 4px 0',
      }}
      onDoubleClick={() => {
        setEditLabel(label)
        setEditing(true)
      }}
    >
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={inputRef}
            className="bg-transparent text-[var(--color-text-muted)] outline-none resize-none w-full"
            style={textCss}
            rows={3}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
              if (e.key === 'Escape') setEditing(false)
            }}
            onBlur={save}
          />
        </div>
      ) : (
        <div
          style={{
            color: 'var(--color-text-muted)',
            whiteSpace: 'pre-wrap',
            ...textCss,
          }}
        >
          {label}
        </div>
      )}

      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
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

export default memo(TextNode)
