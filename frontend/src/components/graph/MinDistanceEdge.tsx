import { memo } from 'react';
import { BaseEdge, useStore } from 'reactflow';
import type { EdgeProps, ReactFlowState } from 'reactflow';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

function closestPointOnRect(
  nodeX: number,
  nodeY: number,
  nodeW: number,
  nodeH: number,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const cx = nodeX + nodeW / 2;
  const cy = nodeY + nodeH / 2;

  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const halfW = nodeW / 2;
  const halfH = nodeH / 2;

  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

export const MinDistanceEdge = memo(({
  id,
  source,
  target,
  style,
  animated,
}: EdgeProps) => {
  const sourceNode = useStore((s: ReactFlowState) => s.nodeInternals.get(source));
  const targetNode = useStore((s: ReactFlowState) => s.nodeInternals.get(target));

  if (!sourceNode || !targetNode) return null;

  const sW = sourceNode.width ?? NODE_WIDTH;
  const sH = sourceNode.height ?? NODE_HEIGHT;
  const tW = targetNode.width ?? NODE_WIDTH;
  const tH = targetNode.height ?? NODE_HEIGHT;

  const sPos = sourceNode.positionAbsolute ?? sourceNode.position;
  const tPos = targetNode.positionAbsolute ?? targetNode.position;

  const tCx = tPos.x + tW / 2;
  const tCy = tPos.y + tH / 2;
  const sCx = sPos.x + sW / 2;
  const sCy = sPos.y + sH / 2;

  const sPoint = closestPointOnRect(sPos.x, sPos.y, sW, sH, tCx, tCy);
  const tPoint = closestPointOnRect(tPos.x, tPos.y, tW, tH, sCx, sCy);

  const path = `M ${sPoint.x} ${sPoint.y} L ${tPoint.x} ${tPoint.y}`;

  const edgeStyle = animated
    ? { ...style, strokeDasharray: 5, animation: 'dashdraw 0.5s linear infinite' }
    : style;

  return (
    <BaseEdge
      path={path}
      style={edgeStyle}
    />
  );
});

MinDistanceEdge.displayName = 'MinDistanceEdge';
