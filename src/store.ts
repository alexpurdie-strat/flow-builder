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

export type AddMode = 'cursor' | 'step' | 'group' | 'text' | 'line'

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

  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  setZoom: (zoom: number) => void
  setSelectedNodes: (ids: string[]) => void
  setAddMode: (mode: AddMode) => void
  setLineStartNode: (id: string | null) => void

  addStepNode: (position: { x: number; y: number }) => void
  addGroupNode: (position: { x: number; y: number }, size?: { width: number; height: number }) => string
  addTextNode: (position: { x: number; y: number }) => void
  addLineNode: (start: { x: number; y: number }, end: { x: number; y: number }) => void
  updateNodeLabel: (id: string, label: string) => void
  updateNodeDescription: (id: string, description: string) => void
  updateNodeEyebrow: (id: string, eyebrow: string) => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void
  groupSelectedNodes: () => void
  ungroupNode: (groupId: string) => void
  handleNodeDropOnGroup: (nodeId: string) => void
  absorbStepsIntoGroup: (groupId: string) => void

  duplicateNode: (id: string, offset?: { x: number; y: number }) => string | null
  linkSelectedNodes: (sourceHandle?: string, targetHandle?: string) => void
  undo: () => void
  redo: () => void
  pushHistory: () => void
  saveToJSON: () => string
  loadFromJSON: (json: string) => void
  clearAll: () => void
}

let idCounter = 0
const nextId = () => `node_${++idCounter}`

const ZOOM_COLLAPSE_THRESHOLD = 0.9

type HistoryEntry = { nodes: Node[]; edges: Edge[] }
const undoStack: HistoryEntry[] = []
const redoStack: HistoryEntry[] = []
const MAX_HISTORY = 50

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  zoom: 1,
  selectedNodes: [],
  addMode: 'cursor' as AddMode,
  lineStartNodeId: null,

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
    const { nodes } = get()
    const collapsed = zoom < ZOOM_COLLAPSE_THRESHOLD

    const updatedNodes = nodes.map((node) => {
      if (node.type === 'group') {
        if (collapsed && !node.data.collapsed) {
          const style = { ...(node.style ?? {}) } as Record<string, unknown>
          const ew = style.width
          const eh = style.height
          delete style.width
          delete style.height
          return {
            ...node,
            data: { ...node.data, collapsed, expandedWidth: ew, expandedHeight: eh },
            style: style as React.CSSProperties,
          }
        }
        if (!collapsed && node.data.collapsed) {
          const { expandedWidth, expandedHeight, ...rest } = node.data as Record<string, unknown>
          return {
            ...node,
            data: { ...rest, collapsed },
            style: { ...(node.style ?? {}), width: (expandedWidth as number) ?? 400, height: (expandedHeight as number) ?? 300 },
          }
        }
        return { ...node, data: { ...node.data, collapsed } }
      }
      if (node.type !== 'group' && (node.parentId || (node.data as StepNodeData).groupId)) {
        return { ...node, hidden: collapsed }
      }
      return node
    })

    set({ zoom, nodes: updatedNodes })
  },

  setSelectedNodes: (ids) => set({ selectedNodes: ids }),
  setAddMode: (mode) => set({ addMode: mode, lineStartNodeId: null }),
  setLineStartNode: (id) => set({ lineStartNodeId: id }),

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
    if (!node || node.type === 'group') return null
    get().pushHistory()

    const newId = nextId()
    const dx = offset?.x ?? 20
    const dy = offset?.y ?? 20
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

  linkSelectedNodes: (sourceHandle?: string, targetHandle?: string) => {
    const { selectedNodes, edges } = get()
    if (selectedNodes.length !== 2) return
    get().pushHistory()

    const [source, target] = selectedNodes
    const exists = edges.some(
      (e) =>
        (e.source === source && e.target === target) ||
        (e.source === target && e.target === source)
    )
    if (exists) return

    set({
      edges: addEdge(
        {
          source,
          target,
          sourceHandle: sourceHandle ?? null,
          targetHandle: targetHandle ?? null,
          type: 'default',
          animated: true,
        },
        edges
      ),
    })
  },

  handleNodeDropOnGroup: (nodeId) => {
    const { nodes } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || node.type === 'group' || node.parentId) return
    get().pushHistory()

    const groups = nodes.filter((n) => n.type === 'group')
    const nodeW = (node.style?.width as number) ?? 160
    const nodeH = (node.style?.height as number) ?? 60
    const nodeCenterX = node.position.x + nodeW / 2
    const nodeCenterY = node.position.y + nodeH / 2

    for (const group of groups) {
      const gw = (group.style?.width as number) ?? 400
      const gh = (group.style?.height as number) ?? 300
      const gx = group.position.x
      const gy = group.position.y

      if (
        nodeCenterX > gx &&
        nodeCenterX < gx + gw &&
        nodeCenterY > gy &&
        nodeCenterY < gy + gh
      ) {
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
            return n
          }),
        })
        return
      }
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

    const stepsToAbsorb = nodes.filter((n) => {
      if (n.type === 'group' || n.parentId || n.id === groupId) return false
      const nodeW = (n.style?.width as number) ?? 160
      const nodeH = (n.style?.height as number) ?? 60
      const cx = n.position.x + nodeW / 2
      const cy = n.position.y + nodeH / 2
      return cx > gx && cx < gx + gw && cy > gy && cy < gy + gh
    })

    if (stepsToAbsorb.length === 0) return
    get().pushHistory()

    set({
      nodes: nodes.map((n) => {
        if (stepsToAbsorb.some((s) => s.id === n.id)) {
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
        set({ nodes: data.nodes, edges: data.edges })
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
