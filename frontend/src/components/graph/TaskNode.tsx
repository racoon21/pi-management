import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Sparkles, ChevronRight, ChevronDown } from 'lucide-react';

// StackHawk 스타일 - 레벨별 Solid 색상
const levelStyles = {
  Root: {
    bg: 'bg-[#8E72EE]',
    border: 'border-[#8E72EE]',
    text: 'text-white',
    badge: 'bg-white/20 text-white',
  },
  L1: {
    bg: 'bg-[#00D7D2]',
    border: 'border-[#00D7D2]',
    text: 'text-[#191927]',
    badge: 'bg-[#191927] text-[#00D7D2]',
  },
  L2: {
    bg: 'bg-[#191927]',
    border: 'border-[#191927]',
    text: 'text-white',
    badge: 'bg-white/20 text-white',
  },
  L3: {
    bg: 'bg-[#7259D9]',
    border: 'border-[#7259D9]',
    text: 'text-white',
    badge: 'bg-white/20 text-white',
  },
  L4: {
    bg: 'bg-[#E4E3EC]',
    border: 'border-[#D0CFD9]',
    text: 'text-[#191927]',
    badge: 'bg-[#191927] text-white',
  },
};

interface TaskNodeData {
  name: string;
  level: keyof typeof levelStyles;
  organization: string;
  is_ai_utilized: boolean;
  isBlurred?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  childCount?: number;
}

export const TaskNode = memo(({ data, selected }: NodeProps<TaskNodeData>) => {
  const styles = levelStyles[data.level] || levelStyles.L4;
  const isBlurred = data.isBlurred;
  const hasChildren = data.hasChildren;
  const isExpanded = data.isExpanded;
  const childCount = data.childCount || 0;

  return (
    <div
      className={`
        relative px-3 py-2 rounded-lg border min-w-[200px] max-w-[280px]
        ${styles.bg} ${selected ? 'ring-2 ring-[#7952B3] ring-offset-2' : styles.border}
        transition-all duration-200 cursor-pointer
        hover:shadow-md hover:scale-[1.02]
        ${isBlurred ? 'opacity-30 blur-[1px] scale-95' : 'opacity-100 blur-0 scale-100'}
      `}
    >
      {/* Top Handle */}
      {data.level !== 'Root' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-gray-400 !border-0"
        />
      )}

      {/* Header - Level Badge & AI indicator */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <div className="flex items-center justify-center w-4 h-4 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={14} className={styles.text} />
              ) : (
                <ChevronRight size={14} className={styles.text} />
              )}
            </div>
          )}
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${styles.badge}`}>
            {data.level}
          </span>
          {/* Child count indicator */}
          {hasChildren && !isExpanded && (
            <span className={`text-[10px] ${styles.text} opacity-70`}>
              (+{childCount})
            </span>
          )}
        </div>
        {data.is_ai_utilized && (
          <div className="flex items-center gap-0.5">
            <Sparkles size={12} className="text-[#7952B3]" />
            <span className={`text-[10px] ${styles.text} opacity-80`}>AI</span>
          </div>
        )}
      </div>

      {/* Text - 여러 줄 표시 (최대 80자, 4줄) */}
      <div className="min-w-0">
        <div
          className={`text-sm font-medium ${styles.text} leading-snug`}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'keep-all',
          }}
          title={data.name}
        >
          {data.name}
        </div>
      </div>

      {/* Bottom Handle */}
      {data.level !== 'L4' && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-gray-400 !border-0"
        />
      )}
    </div>
  );
});

TaskNode.displayName = 'TaskNode';
