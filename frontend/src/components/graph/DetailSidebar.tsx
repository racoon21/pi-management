import { useState, useEffect } from 'react';
import { X, Edit, Trash2, Plus, User, Building, Tag, Calendar, Sparkles, Clock } from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { useModalStore } from '../../stores/modalStore';
import { taskApi } from '../../api';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import type { TaskLevel, TaskHistory } from '../../types/task';
import toast from 'react-hot-toast';

const NEXT_LEVEL: Record<TaskLevel, TaskLevel | null> = {
  Root: 'L1',
  L1: 'L2',
  L2: 'L3',
  L3: 'L4',
  L4: null,
};

// 노드 색상과 일치하는 레벨 스타일
const levelStyles: Record<TaskLevel, { bg: string; text: string; style?: React.CSSProperties }> = {
  Root: { bg: '', text: 'text-white', style: { backgroundColor: '#8E72EE' } },
  L1: { bg: '', text: 'text-white', style: { backgroundColor: '#00D7D2' } },
  L2: { bg: '', text: 'text-white', style: { backgroundColor: '#191927' } },
  L3: { bg: '', text: 'text-white', style: { backgroundColor: '#7259D9' } },
  L4: { bg: '', text: 'text-gray-700', style: { backgroundColor: '#E4E3EC' } },
};

export const DetailSidebar = () => {
  const { selectedTask, selectedTaskId, selectTask, deleteTask } = useTaskStore();
  const { openModal } = useModalStore();
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (selectedTaskId && activeTab === 'history') {
      setIsLoadingHistory(true);
      taskApi.getHistory(selectedTaskId)
        .then(setHistory)
        .catch((err) => console.error('Failed to fetch history:', err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [selectedTaskId, activeTab]);

  if (!selectedTask || !selectedTaskId) {
    return null;
  }
  const nextLevel = NEXT_LEVEL[selectedTask.level as TaskLevel];
  const style = levelStyles[selectedTask.level as TaskLevel] || levelStyles.L4;

  const handleEdit = () => {
    openModal({
      type: 'edit',
      title: '업무 수정',
      data: { taskId: selectedTaskId },
    });
  };

  const handleDelete = () => {
    openModal({
      type: 'delete',
      title: '업무 삭제',
      message: `"${selectedTask?.name}" 업무를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        if (selectedTaskId) {
          try {
            await deleteTask(selectedTaskId);
            toast.success('업무가 삭제되었습니다');
          } catch (error) {
            toast.error('삭제 중 오류가 발생했습니다');
          }
        }
      },
    });
  };

  const handleAddChild = () => {
    if (nextLevel) {
      openModal({
        type: 'create',
        title: '하위 업무 추가',
        data: { parentId: selectedTaskId, level: nextLevel },
      });
    }
  };

  return (
    <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${style.text}`}
            style={style.style}
          >
            {selectedTask.level}
          </span>
          <button
            onClick={() => selectTask(null)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X size={18} />
          </button>
        </div>
        <h3
          className="font-semibold text-gray-900 leading-snug"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'keep-all',
          }}
          title={selectedTask.name}
        >
          {selectedTask.name}
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'detail'
              ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          상세 정보
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          변경 이력
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'detail' ? (
          <div className="space-y-4">
            {/* Info Cards */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Building size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">조직</p>
                  <p className="text-sm font-medium text-gray-900">{selectedTask.organization}</p>
                </div>
              </div>

              {selectedTask.manager_name && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">담당자</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedTask.manager_name}
                      {selectedTask.manager_id && ` (${selectedTask.manager_id})`}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Sparkles size={18} className={selectedTask.is_ai_utilized ? 'text-purple-500' : 'text-gray-400'} />
                <div>
                  <p className="text-xs text-gray-500">AI 활용</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedTask.is_ai_utilized ? '활용 중' : '미활용'}
                  </p>
                </div>
              </div>

              {selectedTask.keywords && selectedTask.keywords.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={18} className="text-gray-400" />
                    <p className="text-xs text-gray-500">키워드</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="default" size="sm">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">최근 수정</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(selectedTask.updated_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isLoadingHistory ? (
              <p className="text-sm text-gray-500 text-center py-8">로딩 중...</p>
            ) : history.length > 0 ? (
              history.map((item, idx) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {new Date(item.changed_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-1">{item.change_type}</p>
                  <p className="text-xs text-gray-500">
                    변경자: {item.changed_by_name || item.changed_by || '알 수 없음'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">변경 이력이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        {nextLevel && (
          <Button
            variant="primary"
            className="w-full"
            icon={Plus}
            onClick={handleAddChild}
          >
            하위 업무 추가 ({nextLevel})
          </Button>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            icon={Edit}
            onClick={handleEdit}
          >
            수정
          </Button>
          {selectedTask.level !== 'Root' && (
            <Button
              variant="danger"
              className="flex-1"
              icon={Trash2}
              onClick={handleDelete}
            >
              삭제
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
