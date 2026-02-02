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

// 노드 크기 상수 (확대된 노드 크기 반영)
const NODE_WIDTH = 280;
const NODE_PADDING = 30; // 노드 간 최소 간격
const MIN_NODE_SPACING = NODE_WIDTH + NODE_PADDING; // 노드 간 최소 거리

// 레벨별 기본 반경 (노드 크기 증가에 따라 조정)
const BASE_RADIUS: Record<string, number> = {
  Root: 0,
  L1: 250,
  L2: 480,
  L3: 700,
  L4: 900,
};

// 레벨 간 최소 거리
const MIN_LEVEL_GAP = 200;

// 방사형 레이아웃 (계층 유지 + 겹침 방지)
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

  // 각 레벨별 보이는 노드 수 계산
  const visibleNodesByLevel = new Map<string, TaskGraphItem[]>();
  tasks.forEach(task => {
    if (isVisible(task)) {
      const levelNodes = visibleNodesByLevel.get(task.level) || [];
      levelNodes.push(task);
      visibleNodesByLevel.set(task.level, levelNodes);
    }
  });

  // 레벨별 반경 계산 (노드 수에 따라 동적 조정, 겹침 방지)
  const levelRadiusCache = new Map<string, number>();

  const calculateRadius = (level: string): number => {
    if (levelRadiusCache.has(level)) {
      return levelRadiusCache.get(level)!;
    }

    const baseRadius = BASE_RADIUS[level] || 400;
    const nodeCount = visibleNodesByLevel.get(level)?.length || 1;

    // 노드가 겹치지 않도록 필요한 최소 반경 계산
    // 원주 = 2πr, 필요한 최소 원주 = nodeCount * MIN_NODE_SPACING
    const minRadiusForNodes = (nodeCount * MIN_NODE_SPACING) / (2 * Math.PI);

    // 이전 레벨과의 간격 유지
    const levels = ['Root', 'L1', 'L2', 'L3', 'L4'];
    const levelIndex = levels.indexOf(level);
    let minRadiusForGap = baseRadius;

    if (levelIndex > 0) {
      const prevLevel = levels[levelIndex - 1];
      const prevRadius = levelRadiusCache.get(prevLevel) || BASE_RADIUS[prevLevel] || 0;
      minRadiusForGap = prevRadius + MIN_LEVEL_GAP;
    }

    const finalRadius = Math.max(baseRadius, minRadiusForNodes, minRadiusForGap);
    levelRadiusCache.set(level, finalRadius);

    return finalRadius;
  };

  // 레벨 순서대로 반경 미리 계산 (의존성 해결)
  const levels = ['Root', 'L1', 'L2', 'L3', 'L4'];
  levels.forEach(level => {
    if (visibleNodesByLevel.has(level)) {
      calculateRadius(level);
    }
  });

  // 보이는 자식의 잎 노드 수 (가중치 계산용)
  const getVisibleLeafCount = (taskId: string): number => {
    const children = childrenMap.get(taskId) || [];
    if (children.length === 0 || !expandedNodes.has(taskId)) return 1;

    const visibleChildren = children.filter(c => isVisible(c));
    if (visibleChildren.length === 0) return 1;

    return visibleChildren.reduce((sum, child) => sum + getVisibleLeafCount(child.id), 0);
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

  // 특정 반경에서 노드 간 겹침 방지를 위한 최소 각도 계산
  const getMinAngleForLevel = (level: string): number => {
    const radius = calculateRadius(level);
    if (radius === 0) return 0;
    // 호의 길이 = 반경 * 각도, 필요한 최소 호 길이 = MIN_NODE_SPACING
    // 따라서 최소 각도 = MIN_NODE_SPACING / 반경
    return MIN_NODE_SPACING / radius;
  };

  // 노드 배치 (재귀)
  const positionNodes = (
    parentId: string,
    startAngle: number,
    endAngle: number
  ): void => {
    const children = childrenMap.get(parentId) || [];
    const visibleChildren = children.filter(c => isVisible(c));

    if (visibleChildren.length === 0) return;

    // 각 자식의 가중치 계산 (펼쳐진 자손 노드 수 기반)
    const weights = visibleChildren.map(child => getVisibleLeafCount(child.id));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let angleRange = endAngle - startAngle;

    // 자식 레벨의 최소 각도 확인
    if (visibleChildren.length > 0) {
      const childLevel = visibleChildren[0].level;
      const minAngle = getMinAngleForLevel(childLevel);
      const requiredAngle = minAngle * visibleChildren.length;

      // 필요한 각도가 할당된 범위보다 크면 각도 범위 확장
      if (requiredAngle > angleRange) {
        const center = (startAngle + endAngle) / 2;
        startAngle = center - requiredAngle / 2;
        endAngle = center + requiredAngle / 2;
        angleRange = endAngle - startAngle;
      }
    }

    let currentAngle = startAngle;

    visibleChildren.forEach((child, index) => {
      const childWeight = weights[index];
      let childAngleRange = (childWeight / totalWeight) * angleRange;

      // 최소 각도 보장
      const minAngle = getMinAngleForLevel(child.level);
      childAngleRange = Math.max(childAngleRange, minAngle);

      const childAngle = currentAngle + childAngleRange / 2;

      // 레벨별 동적 반경 적용
      const radius = calculateRadius(child.level);
      const x = CENTER_X + radius * Math.cos(childAngle);
      const y = CENTER_Y + radius * Math.sin(childAngle);

      const allChildren = childrenMap.get(child.id) || [];
      const hasChildren = allChildren.length > 0;
      const isExpanded = expandedNodes.has(child.id);

      const isSelected = child.id === selectedId;
      const isInPath = isNodeInPath(child.id);
      const shouldBlur = selectedId !== null && !isSelected && !isInPath;

      nodes.push({
        id: child.id,
        type: 'task',
        position: { x, y },
        data: {
          name: child.name,
          level: child.level,
          organization: child.organization,
          is_ai_utilized: child.is_ai_utilized,
          isBlurred: shouldBlur,
          hasChildren,
          isExpanded,
          childCount: allChildren.length,
        },
        selected: isSelected,
      });

      // Edge
      const isEdgeHighlighted = isSelected || isInPath;
      edges.push({
        id: `${parentId}-${child.id}`,
        source: parentId,
        target: child.id,
        type: 'default',
        style: {
          stroke: isEdgeHighlighted ? '#191927' : '#9ca3af',
          strokeWidth: isEdgeHighlighted ? 2.5 : 1.5,
          opacity: shouldBlur ? 0.3 : 1,
        },
        animated: isEdgeHighlighted,
      });

      // 자식 노드들 재귀 배치
      if (isExpanded) {
        positionNodes(child.id, currentAngle, currentAngle + childAngleRange);
      }

      currentAngle += childAngleRange;
    });
  };

  // Root 노드 추가
  const rootChildren = childrenMap.get(root.id) || [];
  const hasChildren = rootChildren.length > 0;
  const isRootExpanded = expandedNodes.has(root.id);
  const isRootSelected = root.id === selectedId;
  const isRootInPath = isNodeInPath(root.id);
  const shouldRootBlur = selectedId !== null && !isRootSelected && !isRootInPath;

  nodes.push({
    id: root.id,
    type: 'task',
    position: { x: CENTER_X, y: CENTER_Y },
    data: {
      name: root.name,
      level: root.level,
      organization: root.organization,
      is_ai_utilized: root.is_ai_utilized,
      isBlurred: shouldRootBlur,
      hasChildren,
      isExpanded: isRootExpanded,
      childCount: rootChildren.length,
    },
    selected: isRootSelected,
  });

  // L1부터 방사형 배치
  if (isRootExpanded) {
    positionNodes(root.id, -Math.PI, Math.PI);
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
