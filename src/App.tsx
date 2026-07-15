import { useCallback, useRef, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  useOnSelectionChange,
  type OnSelectionChangeParams,
  useReactFlow,
  ReactFlowProvider,
  type Node,
} from '@xyflow/react'
import { useFlowStore, type AddMode } from './store'
import { parseFigmaClipboard } from './utils/figma-paste'
import StepNode from './nodes/StepNode'
import GroupNode from './nodes/GroupNode'
import TextNode from './nodes/TextNode'
import LineNode from './nodes/LineNode'
import Toolbar from './components/Toolbar'
import ZoomIndicator from './components/ZoomIndicator'
import LinkNodesOverlay from './components/LinkNodesOverlay'
import RadialMenu from './components/RadialMenu'
import CursorFollower from './components/CursorFollower'
import AlignToolbar from './components/AlignToolbar'

const nodeTypes = {
  step: StepNode,
  group: GroupNode,
  text: TextNode,
  line: LineNode,
}

type DragState = {
  startScreen: { x: number; y: number }
  currentScreen: { x: number; y: number }
  startFlow: { x: number; y: number }
  currentFlow: { x: number; y: number }
  sourceNodeId?: string
}

const MIN_DRAG_SIZE = 40

const SIDES = ['top', 'bottom', 'left', 'right'] as const

function getNodeDims(node: Node): { w: number; h: number } {
  const w = (node.style?.width as number) ?? (node.measured?.width as number) ?? 180
  const h = (node.style?.height as number) ?? (node.measured?.height as number) ?? 60
  return { w, h }
}

function handleOffset(side: string, w: number, h: number) {
  switch (side) {
    case 'top': return { x: w / 2, y: 0 }
    case 'bottom': return { x: w / 2, y: h }
    case 'left': return { x: 0, y: h / 2 }
    case 'right': return { x: w, y: h / 2 }
    default: return { x: w / 2, y: h / 2 }
  }
}

function computeOptimalHandles(sourceNode: Node, targetNode: Node) {
  const sDims = getNodeDims(sourceNode)
  const tDims = getNodeDims(targetNode)
  let bestDist = Infinity
  let bestSource = 'bottom-source'
  let bestTarget = 'top-target'
  for (const sA of SIDES) {
    const oA = handleOffset(sA, sDims.w, sDims.h)
    const ax = sourceNode.position.x + oA.x
    const ay = sourceNode.position.y + oA.y
    for (const sB of SIDES) {
      const oB = handleOffset(sB, tDims.w, tDims.h)
      const bx = targetNode.position.x + oB.x
      const by = targetNode.position.y + oB.y
      const d = Math.hypot(ax - bx, ay - by)
      if (d < bestDist) {
        bestDist = d
        bestSource = `${sA}-source`
        bestTarget = `${sB}-target`
      }
    }
  }
  return { bestSource, bestTarget }
}

function createEdgeBetweenNodes(sourceId: string, targetId: string) {
  const state = useFlowStore.getState()
  const exists = state.edges.some(
    (e) =>
      (e.source === sourceId && e.target === targetId) ||
      (e.source === targetId && e.target === sourceId)
  )
  if (exists) return

  const sourceNode = state.nodes.find((n) => n.id === sourceId)
  const targetNode = state.nodes.find((n) => n.id === targetId)
  if (!sourceNode || !targetNode) return

  const { bestSource, bestTarget } = computeOptimalHandles(sourceNode, targetNode)
  state.pushHistory()
  state.onConnect({
    source: sourceId,
    target: targetId,
    sourceHandle: bestSource,
    targetHandle: bestTarget,
  })
}

function getNodeIdFromElement(el: HTMLElement): string | null {
  const nodeEl = el.closest('.react-flow__node')
  return nodeEl?.getAttribute('data-id') ?? null
}

function Flow() {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const onNodesChange = useFlowStore((s) => s.onNodesChange)
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange)
  const onConnect = useFlowStore((s) => s.onConnect)
  const setZoom = useFlowStore((s) => s.setZoom)
  const setSelectedNodes = useFlowStore((s) => s.setSelectedNodes)
  const addStepNode = useFlowStore((s) => s.addStepNode)
  const addGroupNode = useFlowStore((s) => s.addGroupNode)
  const addTextNode = useFlowStore((s) => s.addTextNode)
  const addLineNode = useFlowStore((s) => s.addLineNode)
  const addMode = useFlowStore((s) => s.addMode)
  const lineStartNodeId = useFlowStore((s) => s.lineStartNodeId)
  const setLineStartNode = useFlowStore((s) => s.setLineStartNode)
  const handleNodeDropOnGroup = useFlowStore((s) => s.handleNodeDropOnGroup)
  const ejectNodeFromGroup = useFlowStore((s) => s.ejectNodeFromGroup)
  const checkGroupCollision = useFlowStore((s) => s.checkGroupCollision)
  const setCollidingGroupIds = useFlowStore((s) => s.setCollidingGroupIds)
  const connectingNodeId = useRef<string | null>(null)

  const undo = useFlowStore((s) => s.undo)
  const redo = useFlowStore((s) => s.redo)
  const { screenToFlowPosition, getViewport } = useReactFlow()

  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const setAddMode = useFlowStore((s) => s.setAddMode)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key.toLowerCase() === 'r') {
        const selectedEdges = useFlowStore.getState().edges.filter((ed) => ed.selected)
        if (selectedEdges.length > 0) {
          e.preventDefault()
          for (const edge of selectedEdges) {
            useFlowStore.getState().reverseEdge(edge.id)
          }
          return
        }
      }

      const keyMap: Record<string, AddMode> = {
        v: 'cursor',
        s: 'step',
        g: 'group',
        l: 'line',
        t: 'text',
      }
      const mode = keyMap[e.key.toLowerCase()]
      if (mode) {
        e.preventDefault()
        setAddMode(mode)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setAddMode('cursor')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setAddMode])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (!e.clipboardData) return

      const viewport = getViewport()
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom

      const html = e.clipboardData.getData('text/html')
      const text = e.clipboardData.getData('text/plain')
      const proxy = {
        getData: (type: string) => type === 'text/html' ? html : type === 'text/plain' ? text : '',
      } as DataTransfer

      const newNodes = await parseFigmaClipboard(proxy, { x: centerX, y: centerY })
      if (newNodes && newNodes.length > 0) {
        const state = useFlowStore.getState()
        state.pushHistory()
        const groups = newNodes.filter(n => n.type === 'group')
        const rest = newNodes.filter(n => n.type !== 'group')
        useFlowStore.setState({ nodes: [...groups, ...state.nodes, ...rest] })
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [getViewport])

  const onSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams) => {
      setSelectedNodes(nodes.map((n: Node) => n.id))
    },
    [setSelectedNodes]
  )

  useOnSelectionChange({ onChange: onSelectionChange })

  const onMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: { zoom: number }) => {
      setZoom(viewport.zoom)
    },
    [setZoom]
  )

  const duplicateNode = useFlowStore((s) => s.duplicateNode)

  const onNodeDragStart = useCallback(
    (event: MouseEvent | TouchEvent, node: Node) => {
      if (!('altKey' in event) || !event.altKey) return
      duplicateNode(node.id, { x: 0, y: 0 })
    },
    [duplicateNode]
  )

  const onNodeDrag = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === 'group') {
        checkGroupCollision(node.id)
      }
    },
    [checkGroupCollision]
  )

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      setCollidingGroupIds([])
      if (node.parentId) {
        ejectNodeFromGroup(node.id)
      } else {
        handleNodeDropOnGroup(node.id)
      }
    },
    [handleNodeDropOnGroup, ejectNodeFromGroup, setCollidingGroupIds]
  )

  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null }) => {
      connectingNodeId.current = params.nodeId
    },
    []
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!connectingNodeId.current) return

      const target = event.target as HTMLElement
      const isPane = target.classList.contains('react-flow__pane')
      if (!isPane) return

      const clientX = 'changedTouches' in event ? event.changedTouches[0].clientX : (event as MouseEvent).clientX
      const clientY = 'changedTouches' in event ? event.changedTouches[0].clientY : (event as MouseEvent).clientY

      const position = screenToFlowPosition({ x: clientX, y: clientY })
      addStepNode(position)
      connectingNodeId.current = null
    },
    [screenToFlowPosition, addStepNode]
  )

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (addMode === 'cursor' || addMode === 'group') return

      if (addMode === 'line') {
        setLineStartNode(null)
        return
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      switch (addMode) {
        case 'step':
          addStepNode(position)
          break
        case 'text':
          addTextNode(position)
          break
      }
    },
    [addMode, screenToFlowPosition, addStepNode, addTextNode, setLineStartNode]
  )

  // Click-click linking: click node A then node B in line mode
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (addMode !== 'line') return
      if (node.type !== 'step' && node.type !== 'group') return

      if (!lineStartNodeId) {
        setLineStartNode(node.id)
      } else {
        if (lineStartNodeId !== node.id) {
          createEdgeBetweenNodes(lineStartNodeId, node.id)
        }
        setLineStartNode(null)
      }
    },
    [addMode, lineStartNodeId, setLineStartNode]
  )

  // --- Drag-to-size for group mode, drag-to-connect/draw for line mode ---

  const handleWrapperMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (addMode !== 'group' && addMode !== 'line') return

      const target = e.target as HTMLElement
      if (target.closest('.react-flow__handle')) return

      if (addMode === 'group') {
        const isPane = target.closest('.react-flow__pane') || target.classList.contains('react-flow__pane')
        if (!isPane) return

        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const state: DragState = {
          startScreen: { x: e.clientX, y: e.clientY },
          currentScreen: { x: e.clientX, y: e.clientY },
          startFlow: flowPos,
          currentFlow: flowPos,
        }
        dragRef.current = state
        setDrag(state)
      }

      if (addMode === 'line') {
        const isCanvas = target.closest('.react-flow__pane') || target.closest('.react-flow__renderer') || target.closest('.react-flow__node')
        if (!isCanvas) return

        const sourceNodeId = getNodeIdFromElement(target) ?? undefined
        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const state: DragState = {
          startScreen: { x: e.clientX, y: e.clientY },
          currentScreen: { x: e.clientX, y: e.clientY },
          startFlow: flowPos,
          currentFlow: flowPos,
          sourceNodeId,
        }
        dragRef.current = state
        setDrag(state)
      }
    },
    [addMode, screenToFlowPosition]
  )

  const handleWrapperMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const updated = {
        ...dragRef.current,
        currentScreen: { x: e.clientX, y: e.clientY },
        currentFlow: flowPos,
      }
      dragRef.current = updated
      setDrag(updated)
    },
    [screenToFlowPosition]
  )

  const handleWrapperMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      setDrag(null)

      if (addMode === 'group') {
        const x = Math.min(d.startFlow.x, d.currentFlow.x)
        const y = Math.min(d.startFlow.y, d.currentFlow.y)
        const w = Math.abs(d.currentFlow.x - d.startFlow.x)
        const h = Math.abs(d.currentFlow.y - d.startFlow.y)

        if (w >= MIN_DRAG_SIZE && h >= MIN_DRAG_SIZE) {
          addGroupNode({ x, y }, { width: w, height: h })
        } else {
          const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          addGroupNode({ x: flowPos.x - 200, y: flowPos.y - 150 })
        }
      }

      if (addMode === 'line') {
        const dist = Math.hypot(d.currentFlow.x - d.startFlow.x, d.currentFlow.y - d.startFlow.y)
        const wasDrag = dist >= MIN_DRAG_SIZE

        if (!wasDrag) return // small movement = click, handled by onNodeClick

        const target = e.target as HTMLElement
        const targetNodeId = getNodeIdFromElement(target)

        if (d.sourceNodeId && targetNodeId && d.sourceNodeId !== targetNodeId) {
          // Drag from node to node → create edge
          createEdgeBetweenNodes(d.sourceNodeId, targetNodeId)
        } else {
          // Drag on empty canvas → create free-floating line
          addLineNode(d.startFlow, d.currentFlow)
        }
      }
    },
    [addMode, addGroupNode, addLineNode, screenToFlowPosition]
  )

  const cursorClass = addMode === 'cursor' ? '' : 'hide-cursor'
  const isDragMode = addMode === 'group' || addMode === 'line'

  return (
    <div
      className={`w-full h-full relative ${cursorClass}`}
      onMouseDown={handleWrapperMouseDown}
      onMouseMove={handleWrapperMouseMove}
      onMouseUp={handleWrapperMouseUp}
    >
      <Toolbar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMove={onMove}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{ type: 'default', animated: true }}
        selectionOnDrag={!isDragMode}
        panOnDrag={isDragMode ? [2] : [1, 2]}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        selectionMode={SelectionMode.Partial}
        nodesDraggable={addMode !== 'line'}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode="Shift"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls position="bottom-right" />
        <MiniMap
          position="top-right"
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{ marginTop: 64 }}
        />
      </ReactFlow>

      {/* Drag preview overlay */}
      {drag && addMode === 'group' && (
        <DragGroupPreview drag={drag} />
      )}
      {drag && addMode === 'line' && (
        <DragLinePreview drag={drag} />
      )}

      <AlignToolbar />
      <LinkNodesOverlay />
      <ZoomIndicator />
      <RadialMenu />
      <CursorFollower />
    </div>
  )
}

function DragGroupPreview({ drag }: { drag: DragState }) {
  const left = Math.min(drag.startScreen.x, drag.currentScreen.x)
  const top = Math.min(drag.startScreen.y, drag.currentScreen.y)
  const width = Math.abs(drag.currentScreen.x - drag.startScreen.x)
  const height = Math.abs(drag.currentScreen.y - drag.startScreen.y)

  if (width < 4 && height < 4) return null

  return (
    <div
      className="fixed pointer-events-none z-[80]"
      style={{
        left,
        top,
        width,
        height,
        border: '2px dashed var(--color-accent)',
        borderRadius: 14,
        background: 'rgba(83, 194, 139, 0.06)',
      }}
    >
      <div
        className="absolute -top-6 left-2 text-[10px] uppercase font-semibold"
        style={{
          color: 'var(--color-accent)',
          letterSpacing: '0.08em',
        }}
      >
        {Math.round(Math.abs(drag.currentFlow.x - drag.startFlow.x))} × {Math.round(Math.abs(drag.currentFlow.y - drag.startFlow.y))}
      </div>
    </div>
  )
}

function DragLinePreview({ drag }: { drag: DragState }) {
  return (
    <svg
      className="fixed inset-0 pointer-events-none z-[80]"
      style={{ width: '100vw', height: '100vh' }}
    >
      <line
        x1={drag.startScreen.x}
        y1={drag.startScreen.y}
        x2={drag.currentScreen.x}
        y2={drag.currentScreen.y}
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeDasharray="6 4"
        opacity={0.7}
      />
      <circle
        cx={drag.startScreen.x}
        cy={drag.startScreen.y}
        r={4}
        fill="var(--color-accent)"
      />
      <circle
        cx={drag.currentScreen.x}
        cy={drag.currentScreen.y}
        r={4}
        fill="var(--color-accent)"
        opacity={0.5}
      />
    </svg>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}
