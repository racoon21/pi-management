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

// 방사형 레벨 반경 (Root, L1, L2만)
const LEVEL_RADIUS: Record<string, number> = {
  Root: 0,
  L1: 400,
  L2: 800,
};

// 계층형 트리 상수 (L3, L4)
const TREE_L3_DEPTH = 240;
const TREE_L4_DEPTH = 220;
const L4_SIBLING_GAP = 100;
const TREE_PADDING = 40;

// 노드 크기 (고정 너비 200px, text-xs 2줄 기준 실제 렌더링 ~68px)
const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

// L4 2열 배치 상수
const L4_COLUMN_THRESHOLD = 4;
const L4_COLUMN_DEPTH_OFFSET = 230;
const MIN_L4_EFFECTIVE_GAP = NODE_HEIGHT + 15;

// 하이브리드 레이아웃: Root→L1→L2 방사형, L2→L3→L4 계층형
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

  const createEdge = (parentId: string, childId: string): void => {
    const isSelected = childId === selectedId;
    const isInPath = isNodeInPath(childId);
    const isEdgeHighlighted = isSelected || isInPath;
    const shouldBlur = selectedId !== null && !isSelected && !isInPath;

    edges.push({
      id: `${parentId}-${childId}`,
      source: parentId,
      target: childId,
      type: 'minDistance',
      style: {
        stroke: isEdgeHighlighted ? '#191927' : '#b0aeb8',
        strokeWidth: isEdgeHighlighted ? 2.5 : 1.5,
        opacity: shouldBlur ? 0.3 : 1,
      },
      animated: isEdgeHighlighted,
    });
  };

  // L2 노드에서 바깥 방향으로 L3/L4를 계층형으로 배치
  const positionL3L4Subtree = (
    l2Id: string,
    l2X: number,
    l2Y: number,
    angularRange: number
  ): void => {
    const l3Children = (childrenMap.get(l2Id) || []).filter(c => isVisible(c));
    if (l3Children.length === 0 || !expandedNodes.has(l2Id)) return;

    // L2에서 중심 바깥 방향 벡터
    const angle = Math.atan2(l2Y - CENTER_Y, l2X - CENTER_X);
    const outX = Math.cos(angle);
    const outY = Math.sin(angle);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    // 수직 전개(perpY 우세)→높이 기준, 수평 전개(perpX 우세)→너비 기준
    const perpNodeExtent = Math.abs(perpX) * NODE_WIDTH + Math.abs(perpY) * NODE_HEIGHT;
    const dynamicGap = Math.max(L4_SIBLING_GAP, perpNodeExtent + 20);
    const dynamicMinGap = perpNodeExtent + 10;

    // 각 L3의 서브트리 높이 계산 (L4 자식 수 기반, 2열 레이아웃 반영)
    const subtreeHeights = l3Children.map(l3 => {
      const l4Children = (childrenMap.get(l3.id) || []).filter(c => isVisible(c));
      const l4Count = expandedNodes.has(l3.id) ? l4Children.length : 0;

      if (l4Count === 0) return perpNodeExtent;

      // 2열 레이아웃: 긴 열 기준 높이 계산
      if (l4Count > L4_COLUMN_THRESHOLD) {
        const col1Count = Math.ceil(l4Count / 2);
        return Math.max(perpNodeExtent, col1Count * dynamicGap);
      }

      return Math.max(perpNodeExtent, l4Count * dynamicGap);
    });

    // 전체 높이 계산
    const totalHeight = subtreeHeights.reduce((sum, h, i) => {
      return sum + h + (i > 0 ? TREE_PADDING : 0);
    }, 0);

    // 사용 가능한 호 길이로 압축 여부 결정
    const l3Radius = Math.sqrt(
      (l2X + outX * TREE_L3_DEPTH) ** 2 +
      (l2Y + outY * TREE_L3_DEPTH) ** 2
    );
    const availableArc = l3Radius * angularRange;
    const rawScaleFactor = availableArc > 0 && totalHeight > availableArc
      ? availableArc / totalHeight
      : 1;
    const minScaleFactor = dynamicMinGap / dynamicGap;
    const scaleFactor = Math.max(rawScaleFactor, minScaleFactor);

    let currentPerpOffset = -totalHeight * scaleFactor / 2;

    l3Children.forEach((l3, i) => {
      const scaledHeight = subtreeHeights[i] * scaleFactor;
      currentPerpOffset += scaledHeight / 2;

      const x3 = l2X + outX * TREE_L3_DEPTH + perpX * currentPerpOffset;
      const y3 = l2Y + outY * TREE_L3_DEPTH + perpY * currentPerpOffset;

      createNode(l3, x3, y3);
      createEdge(l2Id, l3.id);

      // L4 자식 배치
      if (expandedNodes.has(l3.id)) {
        const l4Children = (childrenMap.get(l3.id) || []).filter(c => isVisible(c));
        const useGrid = l4Children.length > L4_COLUMN_THRESHOLD;
        const effectiveGap = dynamicGap * scaleFactor;

        if (useGrid) {
          // 2열 지그재그 배치
          const col1 = l4Children.filter((_, idx) => idx % 2 === 0);
          const col2 = l4Children.filter((_, idx) => idx % 2 === 1);

          // 1열 (짝수 인덱스): 기본 거리
          col1.forEach((l4, j) => {
            const l4PerpOffset = (j - (col1.length - 1) / 2) * effectiveGap;
            const x4 = x3 + outX * TREE_L4_DEPTH + perpX * l4PerpOffset;
            const y4 = y3 + outY * TREE_L4_DEPTH + perpY * l4PerpOffset;
            createNode(l4, x4, y4);
            createEdge(l3.id, l4.id);
          });

          // 2열 (홀수 인덱스): 바깥 방향으로 추가 거리
          col2.forEach((l4, j) => {
            const l4PerpOffset = (j - (col2.length - 1) / 2) * effectiveGap;
            const depthOffset = TREE_L4_DEPTH + L4_COLUMN_DEPTH_OFFSET;
            const x4 = x3 + outX * depthOffset + perpX * l4PerpOffset;
            const y4 = y3 + outY * depthOffset + perpY * l4PerpOffset;
            createNode(l4, x4, y4);
            createEdge(l3.id, l4.id);
          });
        } else {
          // 단일 열 배치 (최소 간격 보장)
          l4Children.forEach((l4, j) => {
            const l4PerpOffset = (j - (l4Children.length - 1) / 2) * effectiveGap;
            const x4 = x3 + outX * TREE_L4_DEPTH + perpX * l4PerpOffset;
            const y4 = y3 + outY * TREE_L4_DEPTH + perpY * l4PerpOffset;
            createNode(l4, x4, y4);
            createEdge(l3.id, l4.id);
          });
        }
      }

      currentPerpOffset += scaledHeight / 2 + Math.max(TREE_PADDING * scaleFactor, TREE_PADDING * 0.6);
    });
  };

  // 방사형 배치 (Root → L1 → L2)
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

    const childLevel = visibleChildren[0].level;
    const childRadius = LEVEL_RADIUS[childLevel] || 900;
    const minAngle = getMinAngleForRadius(childRadius);

    let angleRange = endAngle - startAngle;
    const requiredAngle = minAngle * visibleChildren.length;

    if (requiredAngle > angleRange) {
      const center = (startAngle + endAngle) / 2;
      startAngle = center - requiredAngle / 2;
      endAngle = center + requiredAngle / 2;
      angleRange = requiredAngle;
    }

    const childAngleRange = angleRange / visibleChildren.length;

    let currentAngle = startAngle;

    visibleChildren.forEach((child) => {

      const childAngle = currentAngle + childAngleRange / 2;

      const childX = CENTER_X + childRadius * Math.cos(childAngle);
      const childY = CENTER_Y + childRadius * Math.sin(childAngle);

      createNode(child, childX, childY);
      createEdge(taskId, child.id);

      if (child.level === 'L2') {
        // L2 → L3/L4: 계층형 트리로 전환
        positionL3L4Subtree(child.id, childX, childY, childAngleRange);
      } else {
        // Root → L1, L1 → L2: 방사형 계속
        positionSubtree(child.id, currentAngle, currentAngle + childAngleRange);
      }

      currentAngle += childAngleRange;
    });
  };

  // Root 배치
  createNode(root, CENTER_X, CENTER_Y);

  if (expandedNodes.has(root.id)) {
    positionSubtree(root.id, -Math.PI, Math.PI);
  }

  return { nodes, edges };
};

export const TaskGraph = () => {
  const { tasks, selectedTaskId, selectTask, toggleExpand, expandedNodes, filters } = useTaskStore();

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

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

    return result;
  }, [tasks, filters]);

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
        edgeTypes={edgeTypes}
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
