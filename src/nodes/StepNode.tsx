import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useFlowStore } from '../store'

function StepNode({ id, data, selected }: NodeProps) {
  const { label, description, eyebrow, groupId } = data as { label: string; description?: string; eyebrow?: string; groupId?: string }
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)
  const [editDesc, setEditDesc] = useState(description || '')
  const [editEyebrow, setEditEyebrow] = useState(eyebrow || '')
  const inputRef = useRef<HTMLInputElement>(null)
  const updateLabel = useFlowStore((s) => s.updateNodeLabel)
  const updateDescription = useFlowStore((s) => s.updateNodeDescription)
  const updateEyebrow = useFlowStore((s) => s.updateNodeEyebrow)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const zoom = useFlowStore((s) => s.zoom)

  const isUngrouped = !groupId
  const scale = isUngrouped ? Math.max(1, 1 / zoom) : 1
  const nodeRef = useRef<HTMLDivElement>(null)

  const save = useCallback(() => {
    updateLabel(id, editLabel || 'Untitled')
    updateDescription(id, editDesc)
    updateEyebrow(id, editEyebrow)
    setEditing(false)
  }, [id, editLabel, editDesc, editEyebrow, updateLabel, updateDescription, updateEyebrow])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    if (!editing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
        save()
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [editing, save])

  return (
    <div
      ref={nodeRef}
      className="group relative"
      style={{
        background: 'var(--color-surface)',
        border: `2px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 10,
        padding: '12px 16px',
        width: 180,
        cursor: 'grab',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? '0 0 0 3px rgba(83, 194, 139, 0.15)' : 'none',
        transform: isUngrouped ? `scale(${scale})` : undefined,
        transformOrigin: 'top left',
      }}
      onDoubleClick={() => {
        setEditLabel(label)
        setEditDesc(description || '')
        setEditEyebrow(eyebrow || '')
        setEditing(true)
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

      {editing ? (
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <input
            className="bg-transparent border-b border-[var(--color-border)] text-[var(--color-accent)] uppercase outline-none pb-1"
            style={{ fontSize: 10, letterSpacing: '0.1em' }}
            placeholder="Eyebrow (optional)"
            value={editEyebrow}
            onChange={(e) => setEditEyebrow(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <input
            ref={inputRef}
            className="bg-transparent border-b border-[var(--color-accent)] text-[var(--color-text)] font-medium outline-none pb-1"
            style={{ fontSize: 14 }}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <textarea
            className="bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] outline-none p-1.5 resize-none"
            style={{ fontSize: 12 }}
            rows={2}
            placeholder="Description (optional)"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
          <div className="flex gap-1.5">
            <button
              className="uppercase tracking-wider rounded bg-[var(--color-accent)] text-[var(--color-canvas)] font-semibold"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={save}
            >
              Save
            </button>
            <button
              className="uppercase tracking-wider rounded bg-transparent border border-[var(--color-border)] text-[var(--color-text-muted)]"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {eyebrow && (
            <div
              className="uppercase font-semibold"
              style={{
                color: 'var(--color-accent)',
                fontSize: 10,
                letterSpacing: '0.1em',
                marginBottom: 2,
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            className="font-medium"
            style={{
              color: 'var(--color-text)',
              fontSize: 14,
            }}
          >
            {label}
          </div>
          {description && (
            <div
              className="mt-1"
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 12,
              }}
            >
              {description}
            </div>
          )}
        </>
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

export default memo(StepNode)
