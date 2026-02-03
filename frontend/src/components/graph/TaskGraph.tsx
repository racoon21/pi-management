import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
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

// 레벨별 반경 설정
const LEVEL_RADIUS: Record<string, number> = {
  Root: 0,
  L1: 280,
  L2: 520,
  L3: 760,
  L4: 1000,
};

// 노드 크기
const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

// 방사형 레이아웃 (연결선 꼬임 방지 - 부모 각도 범위 내 자식 배치)
const calculateRadialLayout = (
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

  const CENTER_X = 0;
  const CENTER_Y = 0;

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

    let current = taskMap.get(selectedId);
    while (current) {
      if (current.id === nodeId) return true;
      if (current.parent_id === nodeId) return true;
      current = current.parent_id ? taskMap.get(current.parent_id) : undefined;
    }

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

  // 서브트리의 보이는 잎 노드 수 계산 (각도 가중치용)
  const getVisibleLeafCount = (taskId: string): number => {
    const children = childrenMap.get(taskId) || [];
    const visibleChildren = children.filter(c => isVisible(c));

    if (visibleChildren.length === 0 || !expandedNodes.has(taskId)) {
      return 1;
    }

    return visibleChildren.reduce((sum, child) => sum + getVisibleLeafCount(child.id), 0);
  };

  // 특정 레벨의 반경에서 최소 각도 계산 (노드 겹침 방지)
  const getMinAngleForRadius = (radius: number): number => {
    if (radius === 0) return 0;
    // 호의 길이 = radius * angle, 최소 호 길이 = NODE_WIDTH + padding
    const minArcLength = NODE_WIDTH + 40;
    return minArcLength / radius;
  };

  // 노드 및 엣지 생성 헬퍼
  const createNode = (
    task: TaskGraphItem,
    x: number,
    y: number
  ): void => {
    const children = childrenMap.get(task.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(task.id);
    const isSelected = task.id === selectedId;
    const isInPath = isNodeInPath(task.id);
    const shouldBlur = selectedId !== null && !isSelected && !isInPath;

    nodes.push({
      id: task.id,
      type: 'task',
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
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
  };

  const createEdge = (
    parentId: string,
    childId: string
  ): void => {
    const isSelected = childId === selectedId;
    const isInPath = isNodeInPath(childId);
    const isEdgeHighlighted = isSelected || isInPath;
    const shouldBlur = selectedId !== null && !isSelected && !isInPath;

    edges.push({
      id: `${parentId}-${childId}`,
      source: parentId,
      target: childId,
      type: 'default',
      style: {
        stroke: isEdgeHighlighted ? '#191927' : '#b0aeb8',
        strokeWidth: isEdgeHighlighted ? 2.5 : 1.5,
        opacity: shouldBlur ? 0.3 : 1,
      },
      animated: isEdgeHighlighted,
    });
  };

  // 재귀적으로 노드 배치 (부모의 각도 범위 내에서 자식 배치)
  const positionSubtree = (
    taskId: string,
    startAngle: number,
    endAngle: number
  ): void => {
    const task = taskMap.get(taskId);
    if (!task || !isVisible(task)) return;

    const children = childrenMap.get(taskId) || [];
    const visibleChildren = children.filter(c => isVisible(c));
    const isExpanded = expandedNodes.has(taskId);

    if (visibleChildren.length === 0 || !isExpanded) return;

    // 각 자식의 가중치 (서브트리 크기 기반)
    const weights = visibleChildren.map(child => getVisibleLeafCount(child.id));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // 자식 레벨의 반경
    const childLevel = visibleChildren[0].level;
    const childRadius = LEVEL_RADIUS[childLevel] || 400;
    const minAngle = getMinAngleForRadius(childRadius);

    // 필요한 총 각도 계산
    let angleRange = endAngle - startAngle;
    const requiredAngle = minAngle * visibleChildren.length;

    // 필요한 각도가 부족하면 확장
    if (requiredAngle > angleRange) {
      const center = (startAngle + endAngle) / 2;
      startAngle = center - requiredAngle / 2;
      endAngle = center + requiredAngle / 2;
      angleRange = requiredAngle;
    }

    let currentAngle = startAngle;

    visibleChildren.forEach((child, index) => {
      // 가중치에 따른 각도 할당
      const weight = weights[index];
      let childAngleRange = (weight / totalWeight) * angleRange;
      childAngleRange = Math.max(childAngleRange, minAngle);

      const childAngle = currentAngle + childAngleRange / 2;

      // 자식 위치 계산
      const childX = CENTER_X + childRadius * Math.cos(childAngle);
      const childY = CENTER_Y + childRadius * Math.sin(childAngle);

      // 노드 및 엣지 생성
      createNode(child, childX, childY);
      createEdge(taskId, child.id);

      // 재귀적으로 손자 노드 배치 (현재 자식의 각도 범위 내에서)
      positionSubtree(
        child.id,
        currentAngle,
        currentAngle + childAngleRange
      );

      currentAngle += childAngleRange;
    });
  };

  // Root 노드 배치
  createNode(root, CENTER_X, CENTER_Y);

  // Root가 확장되어 있으면 자식들 배치 (전체 원 사용: -π ~ π)
  if (expandedNodes.has(root.id)) {
    positionSubtree(root.id, -Math.PI, Math.PI);
  }

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
    return calculateRadialLayout(filteredTasks, expandedNodes, selectedTaskId);
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
