import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const filterNodesWithAncestors = (
  tasks: { id: string; parent_id: string | null }[],
  predicate: (task: any) => boolean
): Set<string> => {
  const visibleIds = new Set<string>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const matchingTasks = tasks.filter(predicate);

  matchingTasks.forEach((task) => {
    let current: any = task;
    while (current) {
      visibleIds.add(current.id);
      current = current.parent_id ? taskMap.get(current.parent_id) : undefined;
    }
  });

  return visibleIds;
};
