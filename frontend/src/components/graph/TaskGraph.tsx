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
import { MinDistanceEdge } from './MinDistanceEdge';
import { useTaskStore } from '../../stores/taskStore';
import { useModalStore } from '../../stores/modalStore';
import type { TaskGraphItem, TaskLevel } from '../../types/task';

const nodeTypes = { task: TaskNode };
const edgeTypes = { minDistance: MinDistanceEdge };

const levelColors: Record<TaskLevel, string> = {
  Root: '#8E72EE',
  L1: '#00D7D2',
  L2: '#191927',
  L3: '#7259D9',
  L4: '#E4E3EC',
};

// [Feature 5] L1만 방사형, L2~L4는 계층형
const L1_RADIUS = 400;

// 계층형 트리 상수
const TREE_DEPTH: Record<string, number> = {
  L2: 300,
  L3: 240,
  L4: 220,
};
const L4_SIBLING_GAP = 100;
const TREE_PADDING = 40;

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

const L4_COLUMN_THRESHOLD = 4;
const L4_COLUMN_DEPTH_OFFSET = 230;

const calculateHybridLayout = (
  tasks: TaskGraphItem[],
  expandedNodes: Set<string>,
  selectedId: string | null
): { nodes: Node[]; edges: Edge[] } => {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const childrenMap = new Map<string, TaskGraphItem[]>();

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

  const isVisible = (task: TaskGraphItem): boolean => {
    if (task.level === 'Root') return true;
    if (!task.parent_id) return false;
    const parent = taskMap.get(task.parent_id);
    if (!parent) return false;
    return expandedNodes.has(task.parent_id) && isVisible(parent);
  };

  // [Feature 6] 선택 경로 하이라이트 (페이드아웃 없이)
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

  // [Feature 6] 서브트리 카운트 사전 계산
  const descendantCounts = new Map<string, { total: number; ai: number }>();
  const computeDescendants = (nodeId: string): { total: number; ai: number } => {
    if (descendantCounts.has(nodeId)) return descendantCounts.get(nodeId)!;
    const children = childrenMap.get(nodeId) || [];
    let total = 0;
    let ai = 0;
    for (const child of children) {
      total++;
      if (child.is_ai_utilized) ai++;
      const childCounts = computeDescendants(child.id);
      total += childCounts.total;
      ai += childCounts.ai;
    }
    descendantCounts.set(nodeId, { total, ai });
    return { total, ai };
  };
  tasks.forEach(t => computeDescendants(t.id));

  const getMinAngleForRadius = (radius: number): number => {
    if (radius === 0) return 0;
    const minArcLength = Math.sqrt(NODE_WIDTH ** 2 + NODE_HEIGHT ** 2) + 30;
    return minArcLength / radius;
  };

  const createNode = (task: TaskGraphItem, x: number, y: number): void => {
    const children = childrenMap.get(task.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(task.id);
    const isSelected = task.id === selectedId;
    const counts = descendantCounts.get(task.id) || { total: 0, ai: 0 };

    nodes.push({
      id: task.id,
      type: 'task',
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: {
        name: task.name,
        level: task.level,
        organization: task.organization,
        is_ai_utilized: task.is_ai_utilized,
        isBlurred: false, // [Feature 6] 페이드아웃 제거
        hasChildren,
        isExpanded,
        childCount: children.length,
        totalDescendants: counts.total,
        aiDescendants: counts.ai,
      },
      selected: isSelected,
    });
  };

  const createEdge = (parentId: string, childId: string): void => {
    const isSelected = childId === selectedId;
    const isInPath = isNodeInPath(childId);
    const isEdgeHighlighted = isSelected || isInPath;

    edges.push({
      id: `${parentId}-${childId}`,
      source: parentId,
      target: childId,
      type: 'minDistance',
      style: {
        stroke: isEdgeHighlighted ? '#9B7ACC' : '#4A4A55',
        strokeWidth: isEdgeHighlighted ? 2.5 : 1.5,
        opacity: 1, // [Feature 6] 페이드아웃 제거
      },
      animated: isEdgeHighlighted,
    });
  };

  // [Feature 5] 서브트리 높이 계산 (재귀)
  const getSubtreeExtent = (
    nodeId: string,
    dynamicGap: number,
    perpNodeExtent: number
  ): number => {
    if (!expandedNodes.has(nodeId)) return perpNodeExtent;

    const children = (childrenMap.get(nodeId) || []).filter(c => isVisible(c));
    if (children.length === 0) return perpNodeExtent;

    const childLevel = children[0].level;

    if (childLevel === 'L4') {
      if (children.length > L4_COLUMN_THRESHOLD) {
        return Math.max(perpNodeExtent, Math.ceil(children.length / 2) * dynamicGap);
      }
      return Math.max(perpNodeExtent, children.length * dynamicGap);
    }

    const childExtents = children.map(c => getSubtreeExtent(c.id, dynamicGap, perpNodeExtent));
    return childExtents.reduce((sum, h, i) => sum + h + (i > 0 ? TREE_PADDING : 0), 0);
  };

  // [Feature 5] 재귀적 계층형 배치 (L2/L3/L4)
  const positionHierarchicalSubtree = (
    parentId: string,
    parentX: number,
    parentY: number,
    angularRange: number
  ): void => {
    const allChildren = (childrenMap.get(parentId) || []).filter(c => isVisible(c));
    if (allChildren.length === 0 || !expandedNodes.has(parentId)) return;

    const childLevel = allChildren[0].level;
    const depth = TREE_DEPTH[childLevel];
    if (!depth) return;

    const angle = Math.atan2(parentY - CENTER_Y, parentX - CENTER_X);
    const outX = Math.cos(angle);
    const outY = Math.sin(angle);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    const perpNodeExtent = Math.abs(perpX) * NODE_WIDTH + Math.abs(perpY) * NODE_HEIGHT;
    const dynamicGap = Math.max(L4_SIBLING_GAP, perpNodeExtent + 20);
    const dynamicMinGap = perpNodeExtent + 10;

    // L4 리프 레벨: 2열 레이아웃 지원
    if (childLevel === 'L4') {
      const l4TotalHeight = allChildren.length > L4_COLUMN_THRESHOLD
        ? Math.ceil(allChildren.length / 2) * dynamicGap
        : allChildren.length * dynamicGap;

      const childRadius = Math.sqrt(
        (parentX + outX * depth) ** 2 + (parentY + outY * depth) ** 2
      );
      const availableArc = childRadius * angularRange;
      const rawScale = availableArc > 0 && l4TotalHeight > availableArc
        ? availableArc / l4TotalHeight : 1;
      const scaleFactor = Math.max(rawScale, dynamicMinGap / dynamicGap);
      const effectiveGap = dynamicGap * scaleFactor;

      const useGrid = allChildren.length > L4_COLUMN_THRESHOLD;

      if (useGrid) {
        const col1 = allChildren.filter((_, idx) => idx % 2 === 0);
        const col2 = allChildren.filter((_, idx) => idx % 2 === 1);

        col1.forEach((l4, j) => {
          const offset = (j - (col1.length - 1) / 2) * effectiveGap;
          createNode(l4, parentX + outX * depth + perpX * offset, parentY + outY * depth + perpY * offset);
          createEdge(parentId, l4.id);
        });

        col2.forEach((l4, j) => {
          const offset = (j - (col2.length - 1) / 2) * effectiveGap;
          const d = depth + L4_COLUMN_DEPTH_OFFSET;
          createNode(l4, parentX + outX * d + perpX * offset, parentY + outY * d + perpY * offset);
          createEdge(parentId, l4.id);
        });
      } else {
        allChildren.forEach((l4, j) => {
          const offset = (j - (allChildren.length - 1) / 2) * effectiveGap;
          createNode(l4, parentX + outX * depth + perpX * offset, parentY + outY * depth + perpY * offset);
          createEdge(parentId, l4.id);
        });
      }
      return;
    }

    // 비-리프 자식: 서브트리 높이 기반 배치
    const subtreeHeights = allChildren.map(child =>
      getSubtreeExtent(child.id, dynamicGap, perpNodeExtent)
    );

    const totalHeight = subtreeHeights.reduce((sum, h, i) =>
      sum + h + (i > 0 ? TREE_PADDING : 0), 0
    );

    const childRadius = Math.sqrt(
      (parentX + outX * depth) ** 2 + (parentY + outY * depth) ** 2
    );
    const availableArc = childRadius * angularRange;
    const rawScaleFactor = availableArc > 0 && totalHeight > availableArc
      ? availableArc / totalHeight : 1;
    const minScaleFactor = dynamicMinGap / dynamicGap;
    const scaleFactor = Math.max(rawScaleFactor, minScaleFactor);

    let currentPerpOffset = -totalHeight * scaleFactor / 2;

    allChildren.forEach((child, i) => {
      const scaledHeight = subtreeHeights[i] * scaleFactor;
      currentPerpOffset += scaledHeight / 2;

      const x = parentX + outX * depth + perpX * currentPerpOffset;
      const y = parentY + outY * depth + perpY * currentPerpOffset;

      createNode(child, x, y);
      createEdge(parentId, child.id);

      // 재귀: 하위 레벨 배치
      positionHierarchicalSubtree(child.id, x, y, angularRange);

      currentPerpOffset += scaledHeight / 2 + Math.max(TREE_PADDING * scaleFactor, TREE_PADDING * 0.6);
    });
  };

  // [Feature 5] 방사형 배치: Root → L1만
  const positionRadialL1 = (): void => {
    const visibleL1 = (childrenMap.get(root.id) || []).filter(c => isVisible(c));
    if (visibleL1.length === 0 || !expandedNodes.has(root.id)) return;

    const minAngle = getMinAngleForRadius(L1_RADIUS);
    let startAngle = -Math.PI;
    let endAngle = Math.PI;
    let angleRange = endAngle - startAngle;
    const requiredAngle = minAngle * visibleL1.length;

    if (requiredAngle > angleRange) {
      const center = (startAngle + endAngle) / 2;
      startAngle = center - requiredAngle / 2;
      endAngle = center + requiredAngle / 2;
      angleRange = requiredAngle;
    }

    const childAngleRange = angleRange / visibleL1.length;
    let currentAngle = startAngle;

    visibleL1.forEach((child) => {
      const childAngle = currentAngle + childAngleRange / 2;
      const childX = CENTER_X + L1_RADIUS * Math.cos(childAngle);
      const childY = CENTER_Y + L1_RADIUS * Math.sin(childAngle);

      createNode(child, childX, childY);
      createEdge(root.id, child.id);

      // L1 → L2 → L3 → L4: 계층형
      positionHierarchicalSubtree(child.id, childX, childY, childAngleRange);

      currentAngle += childAngleRange;
    });
  };

  // Root 배치
  createNode(root, CENTER_X, CENTER_Y);

  if (expandedNodes.has(root.id)) {
    positionRadialL1();
  }

  return { nodes, edges };
};

export const TaskGraph = () => {
  const { tasks, selectedTaskId, selectTask, toggleExpand, expandedNodes, filters, focusedL1Id } = useTaskStore();
  const { openModal } = useModalStore();

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (focusedL1Id) {
      const includedIds = new Set<string>();
      const root = result.find(t => t.level === 'Root');
      if (root) includedIds.add(root.id);
      includedIds.add(focusedL1Id);
      const queue = [focusedL1Id];
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const children = result.filter(t => t.parent_id === currentId);
        for (const child of children) {
          includedIds.add(child.id);
          queue.push(child.id);
        }
      }
      result = result.filter(t => includedIds.has(t.id));
    }

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

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matchingTasks = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.organization.toLowerCase().includes(q) ||
        (t.organization_name?.toLowerCase().includes(q) ?? false) ||
        (t.manager_name?.toLowerCase().includes(q) ?? false) ||
        (t.keywords?.some(k => k.toLowerCase().includes(q)) ?? false)
      );
      const includedIds = new Set<string>();
      const addAncestors = (task: TaskGraphItem) => {
        includedIds.add(task.id);
        if (task.parent_id) {
          const parent = result.find(t => t.id === task.parent_id);
          if (parent) addAncestors(parent);
        }
      };
      matchingTasks.forEach(addAncestors);
      result = result.filter(t => includedIds.has(t.id));
    }

    return result;
  }, [tasks, filters, focusedL1Id]);

  const layoutedElements = useMemo(() => {
    return calculateHybridLayout(filteredTasks, expandedNodes, selectedTaskId);
  }, [filteredTasks, expandedNodes, selectedTaskId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedElements.edges);

  useEffect(() => {
    setNodes(layoutedElements.nodes);
    setEdges(layoutedElements.edges);
  }, [layoutedElements, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      toggleExpand(node.id);
      selectTask(node.id);
    },
    [toggleExpand, selectTask]
  );

  // [Feature 6] 더블클릭 → 상세 모달
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      selectTask(node.id);
      openModal({
        type: 'edit',
        title: '업무 상세',
        data: { taskId: node.id },
      });
    },
    [selectTask, openModal]
  );

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
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2A2A35" />
        <Controls className="!bg-card !border-border !shadow-lg !rounded-lg" />
        <MiniMap
          nodeColor={(node) => levelColors[node.data?.level as TaskLevel] || '#666'}
          className="!bg-card !border-border !shadow-lg !rounded-lg"
          maskColor="rgba(0, 0, 0, 0.3)"
        />
      </ReactFlow>
    </div>
  );
};
