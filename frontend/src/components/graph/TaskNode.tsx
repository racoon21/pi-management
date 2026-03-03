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
        relative px-2.5 py-1.5 rounded-lg border w-[200px]
        ${styles.bg} ${selected ? 'ring-2 ring-[#7952B3] ring-offset-2' : styles.border}
        transition-all duration-200 cursor-pointer
        hover:shadow-md hover:scale-[1.02]
        ${isBlurred ? 'opacity-30 blur-[1px] scale-95' : 'opacity-100 blur-0 scale-100'}
      `}
    >
      {/* Target Handle (invisible - custom edge calculates path) */}
      {data.level !== 'Root' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-1 !h-1 !opacity-0 !border-0"
        />
      )}

      {/* Header - Level Badge & AI indicator */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <div className="flex items-center justify-center w-3.5 h-3.5 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={12} className={styles.text} />
              ) : (
                <ChevronRight size={12} className={styles.text} />
              )}
            </div>
          )}
          <span className={`px-1 py-0.5 text-[9px] font-bold rounded ${styles.badge}`}>
            {data.level}
          </span>
          {/* Child count indicator */}
          {hasChildren && !isExpanded && (
            <span className={`text-[9px] ${styles.text} opacity-70`}>
              (+{childCount})
            </span>
          )}
        </div>
        {data.is_ai_utilized && (
          <div className="flex items-center gap-0.5">
            <Sparkles size={10} className="text-[#7952B3]" />
            <span className={`text-[9px] ${styles.text} opacity-80`}>AI</span>
          </div>
        )}
      </div>

      {/* Text - 고정 너비에서 최대 2줄 표시 */}
      <div className="min-w-0">
        <div
          className={`text-xs font-medium ${styles.text} leading-snug`}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'keep-all',
          }}
          title={data.name}
        >
          {data.name}
        </div>
      </div>

      {/* Source Handle (invisible - custom edge calculates path) */}
      {data.level !== 'L4' && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-1 !h-1 !opacity-0 !border-0"
        />
      )}
    </div>
  );
});

TaskNode.displayName = 'TaskNode';
