import { Buffer } from 'buffer'
import type { Node } from '@xyflow/react'

// Ensure Buffer is globally available for fig-kiwi
if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>).Buffer) {
  ;(window as unknown as Record<string, unknown>).Buffer = Buffer
}

let idCounter = Date.now()
const nextId = () => `paste_${++idCounter}`

type NodeChange = {
  type?: string
  name?: string
  size?: { x: number; y: number }
  transform?: { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number }
  visible?: boolean
  textData?: { characters?: string }
  parentIndex?: { guid?: { sessionID?: number; localID?: number }; position?: string }
  guid?: { sessionID?: number; localID?: number }
  phase?: string
}

type ParsedItem = {
  type: 'step' | 'group' | 'text' | 'line'
  label: string
  x: number
  y: number
  width: number
  height: number
}

const GROUP_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'GROUP', 'SECTION'])
const TEXT_TYPES = new Set(['TEXT'])
const SKIP_TYPES = new Set(['DOCUMENT', 'CANVAS', 'BOOLEAN_OPERATION', 'SLICE', 'NONE'])

function getPosition(nc: NodeChange): { x: number; y: number } {
  if (nc.transform) {
    return { x: nc.transform.m02, y: nc.transform.m12 }
  }
  return { x: 0, y: 0 }
}

function getSize(nc: NodeChange): { width: number; height: number } {
  if (nc.size) {
    return { width: nc.size.x, height: nc.size.y }
  }
  return { width: 160, height: 60 }
}

function guidKey(guid?: { sessionID?: number; localID?: number }): string {
  if (!guid) return ''
  return `${guid.sessionID ?? 0}:${guid.localID ?? 0}`
}

function nodeChangesToFlowNodes(
  nodeChanges: NodeChange[],
  viewportCenter: { x: number; y: number }
): Node[] {
  const active = nodeChanges.filter(nc => nc.phase !== 'REMOVED' && nc.visible !== false)

  // Build parent lookup
  const parentMap = new Map<string, string>()
  for (const nc of active) {
    if (nc.parentIndex?.guid) {
      parentMap.set(guidKey(nc.guid), guidKey(nc.parentIndex.guid))
    }
  }

  // Find top-level nodes (no parent or parent not in our set)
  const allGuids = new Set(active.map(nc => guidKey(nc.guid)))
  const topLevel = active.filter(nc => {
    const parentGuid = parentMap.get(guidKey(nc.guid))
    return !parentGuid || !allGuids.has(parentGuid)
  })

  // Find children of each node
  const childrenOf = new Map<string, NodeChange[]>()
  for (const nc of active) {
    const parentGuid = parentMap.get(guidKey(nc.guid))
    if (parentGuid && allGuids.has(parentGuid)) {
      const existing = childrenOf.get(parentGuid) ?? []
      existing.push(nc)
      childrenOf.set(parentGuid, existing)
    }
  }

  const parsed: ParsedItem[] = []

  for (const nc of topLevel) {
    const t = nc.type?.toUpperCase() ?? ''
    if (SKIP_TYPES.has(t)) {
      // Promote children of skipped container nodes
      const children = childrenOf.get(guidKey(nc.guid)) ?? []
      for (const child of children) {
        topLevel.push(child)
      }
      continue
    }

    const pos = getPosition(nc)
    const size = getSize(nc)
    const label = (TEXT_TYPES.has(t) ? nc.textData?.characters : null) || nc.name || 'Untitled'

    if (GROUP_TYPES.has(t)) {
      parsed.push({ type: 'group', label, x: pos.x, y: pos.y, width: size.width, height: size.height })

      const children = childrenOf.get(guidKey(nc.guid)) ?? []
      for (const child of children) {
        const ct = child.type?.toUpperCase() ?? ''
        if (SKIP_TYPES.has(ct)) continue
        const childPos = getPosition(child)
        const childSize = getSize(child)
        const childLabel = (TEXT_TYPES.has(ct) ? child.textData?.characters : null) || child.name || 'Untitled'
        parsed.push({
          type: TEXT_TYPES.has(ct) ? 'text' : 'step',
          label: childLabel,
          x: childPos.x,
          y: childPos.y,
          width: childSize.width,
          height: childSize.height,
        })
      }
    } else if (TEXT_TYPES.has(t)) {
      parsed.push({ type: 'text', label, x: pos.x, y: pos.y, width: size.width, height: size.height })
    } else {
      parsed.push({ type: 'step', label, x: pos.x, y: pos.y, width: size.width, height: size.height })
    }
  }

  if (parsed.length === 0) return []

  // Center content on viewport
  const minX = Math.min(...parsed.map(p => p.x))
  const minY = Math.min(...parsed.map(p => p.y))
  const maxX = Math.max(...parsed.map(p => p.x + p.width))
  const maxY = Math.max(...parsed.map(p => p.y + p.height))
  const offsetX = (minX + maxX) / 2 - viewportCenter.x
  const offsetY = (minY + maxY) / 2 - viewportCenter.y

  const flowNodes: Node[] = []

  for (const p of parsed) {
    const x = p.x - offsetX
    const y = p.y - offsetY

    if (p.type === 'group') {
      flowNodes.push({
        id: nextId(),
        type: 'group',
        position: { x, y },
        data: { label: p.label, collapsed: false },
        style: { width: p.width, height: p.height },
      })
    } else if (p.type === 'text') {
      flowNodes.push({
        id: nextId(),
        type: 'text',
        position: { x, y },
        data: { label: p.label },
      })
    } else {
      flowNodes.push({
        id: nextId(),
        type: 'step',
        position: { x, y },
        data: { label: p.label, description: '' },
      })
    }
  }

  return flowNodes
}

// --- Fallback: plain text lines → nodes ---

function tryPlainTextLines(text: string, viewportCenter: { x: number; y: number }): Node[] | null {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const flowNodes: Node[] = []
  let y = viewportCenter.y - (lines.length * 50)

  for (const line of lines) {
    flowNodes.push({
      id: nextId(),
      type: 'step',
      position: { x: viewportCenter.x - 80, y },
      data: { label: line, description: '' },
    })
    y += 100
  }

  return flowNodes.length > 0 ? flowNodes : null
}

export async function parseFigmaClipboard(
  clipboardData: DataTransfer,
  viewportCenter: { x: number; y: number }
): Promise<Node[] | null> {
  const html = clipboardData.getData('text/html')
  const text = clipboardData.getData('text/plain')

  console.log('[flow-builder paste] HTML length:', html?.length, 'Text:', text?.slice(0, 200))

  // Strategy 1: Figma binary format via fig-kiwi
  if (html && (html.includes('data-metadata') || html.includes('figma'))) {
    try {
      const { readHTMLMessage } = await import('fig-kiwi')
      const parsed = readHTMLMessage(html)
      console.log('[flow-builder paste] fig-kiwi decoded, nodeChanges:', parsed.message?.nodeChanges?.length)

      if (parsed.message?.nodeChanges && parsed.message.nodeChanges.length > 0) {
        const nodes = nodeChangesToFlowNodes(
          parsed.message.nodeChanges as NodeChange[],
          viewportCenter
        )
        if (nodes.length > 0) return nodes
      }
    } catch (err) {
      console.warn('[flow-builder paste] fig-kiwi decode failed:', err)
    }
  }

  // Strategy 2: Plain text lines
  if (text && text.trim().length > 0) {
    return tryPlainTextLines(text, viewportCenter)
  }

  return null
}
