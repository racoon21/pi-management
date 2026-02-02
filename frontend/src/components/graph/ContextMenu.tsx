import { useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, History, Eye, Copy } from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { useModalStore } from '../../stores/modalStore';
import toast from 'react-hot-toast';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeId: string | null;
  onClose: () => void;
}

export const ContextMenu = ({ x, y, nodeId, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { tasks, selectTask, deleteTask } = useTaskStore();
  const { openModal } = useModalStore();

  const task = tasks.find(t => t.id === nodeId);
  const hasChildren = tasks.some(t => t.parent_id === nodeId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust position to prevent overflow
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const handleViewDetail = () => {
    if (nodeId) selectTask(nodeId);
    onClose();
  };

  const handleAddChild = () => {
    if (!task) return;

    openModal({
      type: 'create',
      title: '하위 업무 추가',
      data: { parentId: nodeId, parentLevel: task.level },
    });
    onClose();
  };

  const handleEdit = () => {
    if (nodeId) selectTask(nodeId);
    openModal({
      type: 'edit',
      title: '업무 수정',
      data: { taskId: nodeId },
    });
    onClose();
  };

  const handleDelete = () => {
    if (hasChildren) {
      toast.error('하위 업무가 있는 노드는 삭제할 수 없습니다');
      onClose();
      return;
    }

    openModal({
      type: 'delete',
      title: '업무 삭제',
      message: `"${task?.name}" 업무를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        if (nodeId) {
          try {
            await deleteTask(nodeId);
            toast.success('업무가 삭제되었습니다');
          } catch (error) {
            toast.error('삭제 중 오류가 발생했습니다');
          }
        }
      },
    });
    onClose();
  };

  const handleViewHistory = () => {
    openModal({
      type: 'history',
      title: '변경 이력',
      data: { taskId: nodeId },
    });
    onClose();
  };

  const handleCopyId = () => {
    if (nodeId) {
      navigator.clipboard.writeText(nodeId);
      toast.success('ID가 복사되었습니다');
    }
    onClose();
  };

  const menuItems = [
    { icon: Eye, label: '상세 보기', onClick: handleViewDetail },
    { icon: Plus, label: '하위 업무 추가', onClick: handleAddChild, disabled: task?.level === 'L4' },
    { divider: true },
    { icon: Edit, label: '수정', onClick: handleEdit },
    { icon: History, label: '변경 이력', onClick: handleViewHistory },
    { icon: Copy, label: 'ID 복사', onClick: handleCopyId },
    { divider: true },
    { icon: Trash2, label: '삭제', onClick: handleDelete, danger: true, disabled: hasChildren },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[180px] animate-fadeIn"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {menuItems.map((item, index) => {
        if ('divider' in item && item.divider) {
          return <div key={index} className="my-1 border-t border-gray-100" />;
        }

        const Icon = item.icon!;
        return (
          <button
            key={index}
            onClick={item.onClick}
            disabled={item.disabled}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
              ${item.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
