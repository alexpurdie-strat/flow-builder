import { memo, useState, useRef, useEffect } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useFlowStore } from '../store'

function TextNode({ id, data, selected }: NodeProps) {
  const { label } = data as { label: string }
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

  return (
    <div
      className="group relative"
      style={{
        padding: `${8 * scale}px ${12 * scale}px`,
        cursor: 'grab',
        maxWidth: 300 * scale,
        borderLeft: `2px solid ${selected ? 'var(--color-accent)' : 'var(--color-text-muted)'}`,
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
            style={{ fontSize: `${14 * scale}px` }}
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
            fontSize: `${14 * scale}px`,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
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
