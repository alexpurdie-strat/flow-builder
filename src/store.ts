import type React from 'react'
import { create } from 'zustand'
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'

export type TextStyle = 'body' | 'header' | 'overline'
export type ShapeType = 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'triangle'
export type EndpointStyle = 'none' | 'arrow' | 'arrowclosed' | 'dot'
export type AddMode = 'cursor' | 'step' | 'group' | 'text' | 'line' | 'shape'

export type StepNodeData = {
  label: string
  description?: string
  groupId?: string
}

export type GroupNodeData = {
  label: string
  color?: string
  collapsed?: boolean
}

export type TextNodeData = {
  label: string
}

type FlowState = {
  nodes: Node[]
  edges: Edge[]
  zoom: number
  selectedNodes: string[]
  addMode: AddMode
  lineStartNodeId: string | null
  selectedShape: ShapeType
  collidingGroupIds: string[]

  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setZoom: (zoom: number) => void
  setSelectedNodes: (ids: string[]) => void
  setAddMode: (mode: AddMode) => void
  setLineStartNode: (id: string | null) => void
  setSelectedShape: (shape: ShapeType) => void

  addStepNode: (position: { x: number; y: number }) => void
  addGroupNode: (position: { x: number; y: number }, size?: { width: number; height: number }) => string
  addTextNode: (position: { x: number; y: number }) => void
  addLineNode: (start: { x: number; y: number }, end: { x: number; y: number }) => void
  addShapeNode: (position: { x: number; y: number }) => void
  updateNodeLabel: (id: string, label: string) => void
  updateNodeDescription: (id: string, description: string) => void
  updateNodeEyebrow: (id: string, eyebrow: string) => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void
  reverseEdge: (id: string) => void
  groupSelectedNodes: () => void
  ungroupNode: (groupId: string) => void
  handleNodeDropOnGroup: (nodeId: string) => void
  ejectNodeFromGroup: (nodeId: string) => void
  absorbStepsIntoGroup: (groupId: string) => void
  updateEdgeStyle: (id: string, updates: { strokeWidth?: number; startType?: EndpointStyle; endType?: EndpointStyle }) => void
  updateTextFormat: (id: string, format: { textStyle?: TextStyle; bold?: boolean; italic?: boolean; underline?: boolean }) => void

  setCollidingGroupIds: (ids: string[]) => void
  checkGroupCollision: (draggedId: string) => void
  duplicateNode: (id: string, offset?: { x: number; y: number }) => string | null
  linkSelectedNodes: () => void
  undo: () => void
  redo: () => void
  pushHistory: () => void
  saveToJSON: () => string
  loadFromJSON: (json: string) => void
  clearAll: () => void
}

let idCounter = 0
const nextId = () => `node_${++idCounter}`

const ZOOM_LEVEL_2 = 0.9
const ZOOM_LEVEL_3 = 0.5

type HistoryEntry = { nodes: Node[]; edges: Edge[] }
const undoStack: HistoryEntry[] = []
const redoStack: HistoryEntry[] = []
const MAX_HISTORY = 50
const STORAGE_KEY = 'flow-builder-state'

function loadSaved(): { nodes: Node[]; edges: Edge[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.nodes && data.edges) {
      const maxId = data.nodes.reduce((max: number, n: Node) => {
        const num = parseInt(n.id.replace('node_', ''), 10)
        return isNaN(num) ? max : Math.max(max, num)
      }, 0)
      idCounter = maxId
      const nodes = data.nodes.map((n: Node) => {
        if (n.type === 'group' && (n.data as Record<string, unknown>).collapsed) {
          const { expandedWidth, expandedHeight, ...rest } = n.data as Record<string, unknown>
          const w = (expandedWidth as number) ?? 400
          const h = (expandedHeight as number) ?? 300
          return {
            ...n,
            width: w,
            height: h,
            data: { ...rest, collapsed: false },
            style: { ...(n.style ?? {}), width: w, height: h },
          }
        }
        return { ...n, hidden: false }
      })
      const edges = data.edges.map((e: Edge) => ({ ...e, hidden: false }))
      return { nodes, edges }
    }
  } catch { /* ignore */ }
  return null
}

const saved = loadSaved()

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: saved?.nodes ?? [],
  edges: saved?.edges ?? [],
  zoom: 1,
  selectedNodes: [],
  addMode: 'cursor' as AddMode,
  lineStartNodeId: null,
  selectedShape: 'rectangle' as ShapeType,
  collidingGroupIds: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) })
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection) => {
    set({ edges: addEdge({ ...connection, type: 'default', animated: true }, get().edges) })
  },

  setZoom: (zoom) => {
    const { nodes, edges } = get()
    const level2 = zoom < ZOOM_LEVEL_2
    const level3 = zoom < ZOOM_LEVEL_3

    const groupsWithChildGroups = new Set<string>()
    for (const n of nodes) {
      if (n.type === 'group' && n.parentId) {
        groupsWithChildGroups.add(n.parentId)
      }
    }

    const hiddenNodeIds = new Set<string>()

    const updatedNodes = nodes.map((node) => {
      if (node.type === 'group') {
        const isNested = !!node.parentId
        const hasChildGroups = groupsWithChildGroups.has(node.id)

        if (isNested && level3) {
          hiddenNodeIds.add(node.id)
          return { ...node, hidden: true, data: { ...node.data, collapsed: true } }
        }

        const shouldCollapse = level3 || (level2 && !hasChildGroups)

        if (shouldCollapse && !node.data.collapsed) {
          const style = { ...(node.style ?? {}) } as Record<string, unknown>
          const nodeAny = node as Record<string, unknown>
          const ew = (nodeAny.width as number)
            ?? (style.width as number)
            ?? (node.measured?.width as number)
            ?? 400
          const eh = (nodeAny.height as number)
            ?? (style.height as number)
            ?? (node.measured?.height as number)
            ?? 300
          delete style.width
          delete style.height
          return {
            ...node,
            hidden: false,
            data: { ...node.data, collapsed: true, expandedWidth: ew, expandedHeight: eh },
            style: style as React.CSSProperties,
          }
        }
        if (!shouldCollapse && node.data.collapsed) {
          const { expandedWidth, expandedHeight, ...rest } = node.data as Record<string, unknown>
          const w = (expandedWidth as number) ?? 400
          const h = (expandedHeight as number) ?? 300
          return {
            ...node,
            width: w,
            height: h,
            hidden: false,
            data: { ...rest, collapsed: false },
            style: { ...(node.style ?? {}), width: w, height: h },
          }
        }
        return { ...node, hidden: false, data: { ...node.data, collapsed: shouldCollapse } }
      }
      if (node.parentId || (node.data as StepNodeData).groupId) {
        if (level2) hiddenNodeIds.add(node.id)
        return { ...node, hidden: level2 }
      }
      return node
    })

    const updatedEdges = edges.map((edge) => ({
      ...edge,
      hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
    }))

    set({ zoom, nodes: updatedNodes, edges: updatedEdges })
  },

  setSelectedNodes: (ids) => set({ selectedNodes: ids }),
  setAddMode: (mode) => set({ addMode: mode, lineStartNodeId: null }),
  setLineStartNode: (id) => set({ lineStartNodeId: id }),
  setSelectedShape: (shape) => set({ selectedShape: shape }),

  addStepNode: (position) => {
    get().pushHistory()
    const id = nextId()
    const newNode: Node = {
      id,
      type: 'step',
      position,
      data: { label: 'New Step', description: '' },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  addGroupNode: (position, size) => {
    get().pushHistory()
    const id = nextId()
    const newNode: Node = {
      id,
      type: 'group',
      position,
      data: { label: 'Process Group', collapsed: false },
      style: { width: size?.width ?? 400, height: size?.height ?? 300 },
    }
    set({ nodes: [newNode, ...get().nodes] })
    get().absorbStepsIntoGroup(id)
    return id
  },

  addTextNode: (position) => {
    get().pushHistory()
    const id = nextId()
    const newNode: Node = {
      id,
      type: 'text',
      position,
      data: { label: 'Text annotation' },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  addLineNode: (start, end) => {
    get().pushHistory()
    const id = nextId()
    const newNode: Node = {
      id,
      type: 'line',
      position: start,
      data: { dx: end.x - start.x, dy: end.y - start.y },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  addShapeNode: (position) => {
    get().pushHistory()
    const id = nextId()
    const shape = get().selectedShape
    const newNode: Node = {
      id,
      type: 'shape',
      position,
      data: { label: '', shape },
      style: { width: 120, height: 80 },
    }
    set({ nodes: [...get().nodes, newNode] })
  },

  updateNodeLabel: (id, label) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      ),
    })
  },

  updateNodeDescription: (id, description) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, description } } : n
      ),
    })
  },

  updateNodeEyebrow: (id, eyebrow) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, eyebrow } } : n
      ),
    })
  },

  deleteNode: (id) => {
    get().pushHistory()
    const { nodes, edges } = get()
    const node = nodes.find((n) => n.id === id)

    if (node?.type === 'group') {
      const childIds = nodes
        .filter((n) => n.parentId === id)
        .map((n) => n.id)
      const allRemoveIds = new Set([id, ...childIds])

      set({
        nodes: nodes.filter((n) => !allRemoveIds.has(n.id)),
        edges: edges.filter(
          (e) => !allRemoveIds.has(e.source) && !allRemoveIds.has(e.target)
        ),
      })
    } else {
      set({
        nodes: nodes.filter((n) => n.id !== id),
        edges: edges.filter((e) => e.source !== id && e.target !== id),
      })
    }
  },

  deleteEdge: (id) => {
    get().pushHistory()
    set({ edges: get().edges.filter((e) => e.id !== id) })
  },

  reverseEdge: (id) => {
    get().pushHistory()
    set({
      edges: get().edges.map((e) => {
        if (e.id !== id) return e
        const data = e.data as Record<string, unknown> | undefined
        const startType = data?.startType
        const endType = data?.endType
        return {
          ...e,
          source: e.target,
          target: e.source,
          sourceHandle: e.targetHandle,
          targetHandle: e.sourceHandle,
          data: { ...data, startType: endType, endType: startType },
        }
      }),
    })
  },

  groupSelectedNodes: () => {
    const { nodes, selectedNodes } = get()
    if (selectedNodes.length < 2) return
    get().pushHistory()

    const selected = nodes.filter((n) => selectedNodes.includes(n.id) && n.type !== 'group' && !n.parentId)
    if (selected.length < 2) return

    const minX = Math.min(...selected.map((n) => n.position.x)) - 30
    const minY = Math.min(...selected.map((n) => n.position.y)) - 60
    const maxX = Math.max(...selected.map((n) => n.position.x + 200))
    const maxY = Math.max(...selected.map((n) => n.position.y + 80))

    const groupId = nextId()
    const groupNode: Node = {
      id: groupId,
      type: 'group',
      position: { x: minX, y: minY },
      data: { label: 'Process Group', collapsed: false },
      style: { width: maxX - minX + 60, height: maxY - minY + 60 },
    }

    const updatedNodes = nodes.map((n) => {
      if (selectedNodes.includes(n.id) && n.type !== 'group' && !n.parentId) {
        return {
          ...n,
          parentId: groupId,
          position: {
            x: n.position.x - minX,
            y: n.position.y - minY,
          },
          data: { ...n.data, groupId },
        }
      }
      return n
    })

    set({
      nodes: [groupNode, ...updatedNodes],
      selectedNodes: [],
    })
  },

  duplicateNode: (id, offset) => {
    const { nodes } = get()
    const node = nodes.find((n) => n.id === id)
    if (!node) return null
    get().pushHistory()

    const newId = nextId()
    const dx = offset?.x ?? 20
    const dy = offset?.y ?? 20

    if (node.type === 'group') {
      const children = nodes.filter((n) => n.parentId === id)
      const cloneGroup: Node = {
        ...node,
        id: newId,
        position: { x: node.position.x + dx, y: node.position.y + dy },
        data: { ...node.data },
        selected: true,
        ...(node.style ? { style: { ...node.style } } : {}),
      }
      const cloneChildren = children.map((child) => {
        const childId = nextId()
        return {
          ...child,
          id: childId,
          parentId: newId,
          position: { ...child.position },
          data: { ...child.data, groupId: newId },
          selected: false,
          ...(child.style ? { style: { ...child.style } } : {}),
        }
      })

      set({
        nodes: [
          cloneGroup,
          ...nodes.map((n) => (n.id === id ? { ...n, selected: false } : n)),
          ...cloneChildren,
        ],
      })
      return newId
    }

    const clone: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + dx, y: node.position.y + dy },
      data: { ...node.data },
      selected: true,
      ...(node.style ? { style: { ...node.style } } : {}),
    }

    set({
      nodes: [
        ...nodes.map((n) => (n.id === id ? { ...n, selected: false } : n)),
        clone,
      ],
    })
    return newId
  },

  linkSelectedNodes: () => {
    const { selectedNodes, nodes, edges } = get()
    if (selectedNodes.length < 2) return

    const linkable = selectedNodes.filter((id) => {
      const n = nodes.find((nd) => nd.id === id)
      return n?.type === 'step' || n?.type === 'group' || n?.type === 'shape'
    })
    if (linkable.length < 2) return
    get().pushHistory()

    const [sourceId, ...targetIds] = linkable
    const sourceNode = nodes.find((n) => n.id === sourceId)
    if (!sourceNode) return

    let currentEdges = edges
    for (const targetId of targetIds) {
      const exists = currentEdges.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
      )
      if (exists) continue

      const targetNode = nodes.find((n) => n.id === targetId)
      if (!targetNode) continue

      const sides = ['top', 'bottom', 'left', 'right'] as const
      const getDim = (nd: typeof sourceNode) => ({
        w: (nd.style?.width as number) ?? (nd.measured?.width as number) ?? 180,
        h: (nd.style?.height as number) ?? (nd.measured?.height as number) ?? 60,
      })
      const offset = (side: string, w: number, h: number) => {
        switch (side) {
          case 'top': return { x: w / 2, y: 0 }
          case 'bottom': return { x: w / 2, y: h }
          case 'left': return { x: 0, y: h / 2 }
          case 'right': return { x: w, y: h / 2 }
          default: return { x: w / 2, y: h / 2 }
        }
      }
      const sDim = getDim(sourceNode)
      const tDim = getDim(targetNode)

      let bestDist = Infinity
      let bestSH = 'bottom-source'
      let bestTH = 'top-target'
      for (const sA of sides) {
        const oA = offset(sA, sDim.w, sDim.h)
        const ax = sourceNode.position.x + oA.x
        const ay = sourceNode.position.y + oA.y
        for (const sB of sides) {
          const oB = offset(sB, tDim.w, tDim.h)
          const bx = targetNode.position.x + oB.x
          const by = targetNode.position.y + oB.y
          const d = Math.hypot(ax - bx, ay - by)
          if (d < bestDist) {
            bestDist = d
            bestSH = `${sA}-source`
            bestTH = `${sB}-target`
          }
        }
      }

      currentEdges = addEdge(
        {
          source: sourceId,
          target: targetId,
          sourceHandle: bestSH,
          targetHandle: bestTH,
          type: 'default',
          animated: true,
        },
        currentEdges
      )
    }

    set({ edges: currentEdges })
  },

  handleNodeDropOnGroup: (nodeId) => {
    const { nodes } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || node.parentId) return

    const isGroup = node.type === 'group'
    const nodeW = (node.style?.width as number) ?? (isGroup ? ((node.data as Record<string, unknown>).expandedWidth as number ?? 400) : 160)
    const nodeH = (node.style?.height as number) ?? (isGroup ? ((node.data as Record<string, unknown>).expandedHeight as number ?? 300) : 60)

    const groups = nodes.filter((n) => n.type === 'group' && n.id !== nodeId)

    for (const group of groups) {
      const gw = (group.style?.width as number) ?? 400
      const gh = (group.style?.height as number) ?? 300
      const gx = group.position.x
      const gy = group.position.y

      if (isGroup) {
        const fullyInside =
          node.position.x >= gx &&
          node.position.y >= gy &&
          node.position.x + nodeW <= gx + gw &&
          node.position.y + nodeH <= gy + gh
        if (!fullyInside) continue
      } else {
        const cx = node.position.x + nodeW / 2
        const cy = node.position.y + nodeH / 2
        if (!(cx > gx && cx < gx + gw && cy > gy && cy < gy + gh)) continue
      }

      get().pushHistory()
      const childNodes = isGroup ? nodes.filter((n) => n.parentId === nodeId) : []
      set({
        nodes: nodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              parentId: group.id,
              position: {
                x: n.position.x - gx,
                y: n.position.y - gy,
              },
              data: { ...n.data, groupId: group.id },
            }
          }
          if (isGroup && childNodes.some((c) => c.id === n.id)) {
            return {
              ...n,
              position: {
                x: n.position.x,
                y: n.position.y,
              },
            }
          }
          return n
        }),
      })
      return
    }
  },

  ejectNodeFromGroup: (nodeId) => {
    const { nodes } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || !node.parentId) return

    const group = nodes.find((n) => n.id === node.parentId)
    if (!group) return

    const gw = (group.style?.width as number) ?? 400
    const gh = (group.style?.height as number) ?? 300

    const nodeW = (node.measured?.width as number) ?? (node.style?.width as number) ?? 180
    const nodeH = (node.measured?.height as number) ?? (node.style?.height as number) ?? 60
    const cx = node.position.x + nodeW / 2
    const cy = node.position.y + nodeH / 2

    if (cx < 0 || cx > gw || cy < 0 || cy > gh) {
      get().pushHistory()
      set({
        nodes: nodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              parentId: undefined,
              position: {
                x: n.position.x + group.position.x,
                y: n.position.y + group.position.y,
              },
              data: { ...n.data, groupId: undefined },
            }
          }
          return n
        }),
      })
    }
  },

  setCollidingGroupIds: (ids) => set({ collidingGroupIds: ids }),

  checkGroupCollision: (draggedId) => {
    const { nodes } = get()
    const dragged = nodes.find((n) => n.id === draggedId)
    if (!dragged || dragged.type !== 'group') {
      if (get().collidingGroupIds.length > 0) set({ collidingGroupIds: [] })
      return
    }

    const dw = (dragged.style?.width as number) ?? (dragged.data as Record<string, unknown>).expandedWidth as number ?? 400
    const dh = (dragged.style?.height as number) ?? (dragged.data as Record<string, unknown>).expandedHeight as number ?? 300
    const dx = dragged.position.x
    const dy = dragged.position.y

    const colliding: string[] = []
    for (const node of nodes) {
      if (node.type !== 'group' || node.id === draggedId) continue
      const gw = (node.style?.width as number) ?? (node.data as Record<string, unknown>).expandedWidth as number ?? 400
      const gh = (node.style?.height as number) ?? (node.data as Record<string, unknown>).expandedHeight as number ?? 300
      const gx = node.position.x
      const gy = node.position.y

      const overlaps = dx < gx + gw && dx + dw > gx && dy < gy + gh && dy + dh > gy
      if (!overlaps) continue

      const draggedInsideOther = dx >= gx && dy >= gy && dx + dw <= gx + gw && dy + dh <= gy + gh
      const otherInsideDragged = gx >= dx && gy >= dy && gx + gw <= dx + dw && gy + gh <= dy + dh

      if (!draggedInsideOther && !otherInsideDragged) {
        colliding.push(node.id)
      }
    }

    const prev = get().collidingGroupIds
    if (colliding.length !== prev.length || colliding.some((id, i) => id !== prev[i])) {
      set({ collidingGroupIds: colliding })
    }
  },

  absorbStepsIntoGroup: (groupId) => {
    const { nodes } = get()
    const group = nodes.find((n) => n.id === groupId)
    if (!group) return

    const gx = group.position.x
    const gy = group.position.y
    const gw = (group.style?.width as number) ?? 400
    const gh = (group.style?.height as number) ?? 300

    const toAbsorb = nodes.filter((n) => {
      if (n.parentId || n.id === groupId) return false
      if (n.type === 'group') {
        const nw = (n.style?.width as number) ?? (n.data as Record<string, unknown>).expandedWidth as number ?? 400
        const nh = (n.style?.height as number) ?? (n.data as Record<string, unknown>).expandedHeight as number ?? 300
        return n.position.x >= gx && n.position.y >= gy &&
          n.position.x + nw <= gx + gw && n.position.y + nh <= gy + gh
      }
      const nodeW = (n.style?.width as number) ?? 160
      const nodeH = (n.style?.height as number) ?? 60
      const cx = n.position.x + nodeW / 2
      const cy = n.position.y + nodeH / 2
      return cx > gx && cx < gx + gw && cy > gy && cy < gy + gh
    })

    if (toAbsorb.length === 0) return
    get().pushHistory()

    const absorbIds = new Set(toAbsorb.map((n) => n.id))
    set({
      nodes: nodes.map((n) => {
        if (absorbIds.has(n.id)) {
          return {
            ...n,
            parentId: groupId,
            position: {
              x: n.position.x - gx,
              y: n.position.y - gy,
            },
            data: { ...n.data, groupId },
          }
        }
        return n
      }),
    })
  },

  updateEdgeStyle: (id, updates) => {
    get().pushHistory()
    set({
      edges: get().edges.map((e) => {
        if (e.id !== id) return e
        const data = { ...(e.data ?? {}) } as Record<string, unknown>
        if (updates.strokeWidth !== undefined) data.strokeWidth = updates.strokeWidth
        if (updates.startType !== undefined) data.startType = updates.startType
        if (updates.endType !== undefined) data.endType = updates.endType
        return { ...e, data }
      }),
    })
  },

  updateTextFormat: (id, format) => {
    get().pushHistory()
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== id) return n
        const data = { ...n.data } as Record<string, unknown>
        if (format.textStyle !== undefined) data.textStyle = format.textStyle
        if (format.bold !== undefined) data.bold = format.bold
        if (format.italic !== undefined) data.italic = format.italic
        if (format.underline !== undefined) data.underline = format.underline
        return { ...n, data }
      }),
    })
  },

  ungroupNode: (groupId) => {
    const { nodes } = get()
    const groupNode = nodes.find((n) => n.id === groupId)
    if (!groupNode) return
    get().pushHistory()

    const updatedNodes = nodes
      .filter((n) => n.id !== groupId)
      .map((n) => {
        if (n.parentId === groupId) {
          return {
            ...n,
            parentId: undefined,
            position: {
              x: n.position.x + groupNode.position.x,
              y: n.position.y + groupNode.position.y,
            },
            data: { ...n.data, groupId: undefined },
          }
        }
        return n
      })

    set({ nodes: updatedNodes })
  },

  pushHistory: () => {
    const { nodes, edges } = get()
    undoStack.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    })
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack.length = 0
  },

  undo: () => {
    const entry = undoStack.pop()
    if (!entry) return
    const { nodes, edges } = get()
    redoStack.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    })
    set({ nodes: entry.nodes, edges: entry.edges })
  },

  redo: () => {
    const entry = redoStack.pop()
    if (!entry) return
    const { nodes, edges } = get()
    undoStack.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    })
    set({ nodes: entry.nodes, edges: entry.edges })
  },

  saveToJSON: () => {
    const { nodes, edges } = get()
    return JSON.stringify({ nodes, edges }, null, 2)
  },

  loadFromJSON: (json) => {
    try {
      const data = JSON.parse(json)
      if (data.nodes && data.edges) {
        const maxId = data.nodes.reduce((max: number, n: Node) => {
          const num = parseInt(n.id.replace('node_', ''), 10)
          return isNaN(num) ? max : Math.max(max, num)
        }, 0)
        idCounter = maxId
        const nodes = data.nodes.map((n: Node) => {
          if (n.type === 'group' && (n.data as Record<string, unknown>).collapsed) {
            const { expandedWidth, expandedHeight, ...rest } = n.data as Record<string, unknown>
            const w = (expandedWidth as number) ?? (n as Record<string, unknown>).width as number ?? (n.style?.width as number) ?? 400
            const h = (expandedHeight as number) ?? (n as Record<string, unknown>).height as number ?? (n.style?.height as number) ?? 300
            return {
              ...n,
              width: w,
              height: h,
              hidden: false,
              data: { ...rest, collapsed: false },
              style: { ...(n.style ?? {}), width: w, height: h },
            }
          }
          return { ...n, hidden: false }
        })
        const edges = data.edges.map((e: Edge) => ({ ...e, hidden: false }))
        set({ nodes, edges })
      }
    } catch {
      console.error('Invalid JSON')
    }
  },

  clearAll: () => {
    get().pushHistory()
    idCounter = 0
    set({ nodes: [], edges: [] })
  },
}))

useFlowStore.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: state.nodes, edges: state.edges }))
  } catch { /* quota exceeded, ignore */ }
})
