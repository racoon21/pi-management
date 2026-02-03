import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  ConnectionLineType,
} from 'reactflow';
import type { Node, Edge, NodeMouseHandler } from 'reactflow';
import 'reactflow/dist/style.css';
import { TaskNode } from './TaskNode';
import { useTaskStore } from '../../stores/taskStore';
import type { TaskGraphItem, TaskLevel } from '../../types/task';

const nodeTypes = { task: TaskNode };

const levelColors: Record<TaskLevel, string> = {
  Root: '#8E72EE',
  L1: '#00D7D2',
  L2: '#191927',
  L3: '#7259D9',
  L4: '#E4E3EC',
};

// 노드 크기 상수
const NODE_HEIGHT = 70;
const HORIZONTAL_SPACING = 280; // 레벨 간 수평 간격
const VERTICAL_SPACING = 100; // 노드 간 수직 간격

// 수평 계층형 레이아웃 (좌→우, 연결선 꼬임 방지)
const calculateHierarchicalLayout = (
  tasks: TaskGraphItem[],
  expandedNodes: Set<string>,
  selectedId: string | null
): { nodes: Node[]; edges: Edge[] } => {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const childrenMap = new Map<string, TaskGraphItem[]>();

  // Build children map
  tasks.forEach(task => {
    if (task.parent_id) {
      const children = childrenMap.get(task.parent_id) || [];
      children.push(task);
      childrenMap.set(task.parent_id, children);
    }
  });

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const root = tasks.find(t => t.level === 'Root');
  if (!root) return { nodes, edges };

  // 보이는 노드인지 확인
  const isVisible = (task: TaskGraphItem): boolean => {
    if (task.level === 'Root') return true;
    if (!task.parent_id) return false;
    const parent = taskMap.get(task.parent_id);
    if (!parent) return false;
    return expandedNodes.has(task.parent_id) && isVisible(parent);
  };

  // Check if nodeId is in the path to selectedId
  const isNodeInPath = (nodeId: string): boolean => {
    if (!selectedId) return false;

    // Check if nodeId is ancestor of selectedId
    let current = taskMap.get(selectedId);
    while (current) {
      if (current.id === nodeId) return true;
      if (current.parent_id === nodeId) return true;
      current = current.parent_id ? taskMap.get(current.parent_id) : undefined;
    }

    // Check if nodeId is descendant of selectedId
    const checkDescendants = (parentId: string): boolean => {
      const children = childrenMap.get(parentId) || [];
      for (const child of children) {
        if (child.id === nodeId) return true;
        if (checkDescendants(child.id)) return true;
      }
      return false;
    };

    return checkDescendants(selectedId);
  };

  // 서브트리의 총 높이 계산 (보이는 노드만)
  const getSubtreeHeight = (taskId: string): number => {
    const children = childrenMap.get(taskId) || [];
    const visibleChildren = children.filter(c => isVisible(c));

    if (visibleChildren.length === 0 || !expandedNodes.has(taskId)) {
      return NODE_HEIGHT;
    }

    const childrenTotalHeight = visibleChildren.reduce((sum, child) => {
      return sum + getSubtreeHeight(child.id);
    }, 0);

    // 자식들 사이의 간격 추가
    const gaps = Math.max(0, visibleChildren.length - 1) * VERTICAL_SPACING;

    return Math.max(NODE_HEIGHT, childrenTotalHeight + gaps);
  };

  // 레벨별 X 좌표 계산
  const getLevelX = (level: string): number => {
    const levels = ['Root', 'L1', 'L2', 'L3', 'L4'];
    const index = levels.indexOf(level);
    return index * HORIZONTAL_SPACING;
  };

  // 노드 배치 (재귀) - 부모 중심으로 자식들을 수직 정렬
  const positionNodes = (
    taskId: string,
    startY: number
  ): number => {
    const task = taskMap.get(taskId);
    if (!task || !isVisible(task)) return startY;

    const children = childrenMap.get(taskId) || [];
    const visibleChildren = children.filter(c => isVisible(c));
    const isExpanded = expandedNodes.has(taskId);

    let subtreeHeight = getSubtreeHeight(taskId);
    const nodeX = getLevelX(task.level);

    // 자식이 없거나 접혀있으면 현재 노드만 배치
    if (visibleChildren.length === 0 || !isExpanded) {
      const nodeY = startY + subtreeHeight / 2 - NODE_HEIGHT / 2;

      const hasChildren = children.length > 0;
      const isSelected = task.id === selectedId;
      const isInPath = isNodeInPath(task.id);
      const shouldBlur = selectedId !== null && !isSelected && !isInPath;

      nodes.push({
        id: task.id,
        type: 'task',
        position: { x: nodeX, y: nodeY },
        data: {
          name: task.name,
          level: task.level,
          organization: task.organization,
          is_ai_utilized: task.is_ai_utilized,
          isBlurred: shouldBlur,
          hasChildren,
          isExpanded,
          childCount: children.length,
        },
        selected: isSelected,
      });

      return startY + subtreeHeight;
    }

    // 자식들의 서브트리 높이 계산
    const childHeights = visibleChildren.map(child => getSubtreeHeight(child.id));
    const totalChildrenHeight = childHeights.reduce((a, b) => a + b, 0);
    const totalGaps = Math.max(0, visibleChildren.length - 1) * VERTICAL_SPACING;
    const childrenBlockHeight = totalChildrenHeight + totalGaps;

    // 자식들 배치
    let currentY = startY;
    const childCenters: number[] = [];

    visibleChildren.forEach((child, index) => {
      const childHeight = childHeights[index];
      const childCenter = currentY + childHeight / 2;
      childCenters.push(childCenter);

      // 재귀적으로 자식 서브트리 배치
      positionNodes(child.id, currentY);

      // 엣지 추가
      const isSelected = child.id === selectedId;
      const isInPath = isNodeInPath(child.id);
      const isEdgeHighlighted = isSelected || isInPath;
      const shouldBlur = selectedId !== null && !isSelected && !isInPath;

      edges.push({
        id: `${taskId}-${child.id}`,
        source: taskId,
        target: child.id,
        type: 'smoothstep',
        style: {
          stroke: isEdgeHighlighted ? '#191927' : '#9ca3af',
          strokeWidth: isEdgeHighlighted ? 2.5 : 1.5,
          opacity: shouldBlur ? 0.3 : 1,
        },
        animated: isEdgeHighlighted,
      });

      currentY += childHeight + VERTICAL_SPACING;
    });

    // 부모 노드는 자식들의 중앙에 배치
    const firstChildCenter = childCenters[0];
    const lastChildCenter = childCenters[childCenters.length - 1];
    const parentY = (firstChildCenter + lastChildCenter) / 2 - NODE_HEIGHT / 2;

    const hasChildren = children.length > 0;
    const isSelected = task.id === selectedId;
    const isInPath = isNodeInPath(task.id);
    const shouldBlur = selectedId !== null && !isSelected && !isInPath;

    nodes.push({
      id: task.id,
      type: 'task',
      position: { x: nodeX, y: parentY },
      data: {
        name: task.name,
        level: task.level,
        organization: task.organization,
        is_ai_utilized: task.is_ai_utilized,
        isBlurred: shouldBlur,
        hasChildren,
        isExpanded,
        childCount: children.length,
      },
      selected: isSelected,
    });

    return startY + childrenBlockHeight;
  };

  // Root부터 시작
  positionNodes(root.id, 0);

  return { nodes, edges };
};

export const TaskGraph = () => {
  const { tasks, selectedTaskId, selectTask, toggleExpand, expandedNodes, filters } = useTaskStore();

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Apply organization filter
    if (filters.organization) {
      const orgTasks = result.filter(t => t.organization === filters.organization);
      const includedIds = new Set<string>();

      const addAncestors = (task: TaskGraphItem) => {
        includedIds.add(task.id);
        if (task.parent_id) {
          const parent = result.find(t => t.id === task.parent_id);
          if (parent) addAncestors(parent);
        }
      };

      orgTasks.forEach(addAncestors);
      result = result.filter(t => includedIds.has(t.id));
    }

    // Apply level filter
    if (filters.level) {
      const levelTasks = result.filter(t => t.level === filters.level);
      const includedIds = new Set<string>();

      const addAncestors = (task: TaskGraphItem) => {
        includedIds.add(task.id);
        if (task.parent_id) {
          const parent = result.find(t => t.id === task.parent_id);
          if (parent) addAncestors(parent);
        }
      };

      levelTasks.forEach(addAncestors);
      result = result.filter(t => includedIds.has(t.id));
    }

    // Apply AI filter
    if (filters.isAiUtilized !== null) {
      const aiTasks = result.filter(t => t.is_ai_utilized === filters.isAiUtilized);
      const includedIds = new Set<string>();

      const addAncestors = (task: TaskGraphItem) => {
        includedIds.add(task.id);
        if (task.parent_id) {
          const parent = result.find(t => t.id === task.parent_id);
          if (parent) addAncestors(parent);
        }
      };

      aiTasks.forEach(addAncestors);
      result = result.filter(t => includedIds.has(t.id));
    }

    return result;
  }, [tasks, filters]);

  // Calculate layout
  const layoutedElements = useMemo(() => {
    return calculateHierarchicalLayout(filteredTasks, expandedNodes, selectedTaskId);
  }, [filteredTasks, expandedNodes, selectedTaskId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedElements.edges);

  // Update when layout changes
  useEffect(() => {
    setNodes(layoutedElements.nodes);
    setEdges(layoutedElements.edges);
  }, [layoutedElements, setNodes, setEdges]);

  // Handle node click - toggle expand and select
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      toggleExpand(node.id);
      selectTask(node.id);
    },
    [toggleExpand, selectTask]
  );

  // Handle pane click - deselect
  const handlePaneClick = useCallback(() => {
    selectTask(null);
  }, [selectTask]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#D0CFD9" />
        <Controls className="!bg-white !border-gray-200 !shadow-lg !rounded-lg" />
        <MiniMap
          nodeColor={(node) => levelColors[node.data?.level as TaskLevel] || '#666'}
          className="!bg-white !border-gray-200 !shadow-lg !rounded-lg"
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
};
