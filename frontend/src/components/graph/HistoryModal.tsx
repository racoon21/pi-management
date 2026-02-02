import { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Badge } from '../shared/Badge';
import { useModalStore } from '../../stores/modalStore';
import { useTaskStore } from '../../stores/taskStore';
import { taskApi } from '../../api';
import type { TaskHistory } from '../../types/task';
import { Clock, User, FileText } from 'lucide-react';
import { clsx } from 'clsx';

export const HistoryModal = () => {
  const { isOpen, type, data, closeModal } = useModalStore();
  const { tasks } = useTaskStore();
  const [histories, setHistories] = useState<TaskHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && type === 'history' && data?.taskId) {
      setIsLoading(true);
      taskApi.getHistory(data.taskId)
        .then(setHistories)
        .catch((err) => console.error('Failed to fetch history:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, type, data?.taskId]);

  if (!isOpen || type !== 'history') return null;

  const task = tasks.find(t => t.id === data?.taskId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={`변경 이력 - ${task?.name || ''}`}
      size="lg"
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            로딩 중...
          </div>
        ) : histories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            변경 이력이 없습니다
          </div>
        ) : (
          <div className="space-y-4">
            {histories.map((history, index) => (
              <div
                key={history.id}
                className={clsx(
                  'p-4 rounded-lg border relative',
                  index === 0 ? 'border-[#7952B3] bg-[#7952B3]/5' : 'border-gray-200'
                )}
              >
                {/* Timeline connector */}
                {index < histories.length - 1 && (
                  <div className="absolute left-7 top-full w-0.5 h-4 bg-gray-200" />
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      history.change_type === 'CREATE' && 'bg-green-100',
                      history.change_type === 'UPDATE' && 'bg-yellow-100',
                      history.change_type === 'DELETE' && 'bg-red-100'
                    )}
                  >
                    <FileText
                      size={18}
                      className={clsx(
                        history.change_type === 'CREATE' && 'text-green-600',
                        history.change_type === 'UPDATE' && 'text-yellow-600',
                        history.change_type === 'DELETE' && 'text-red-600'
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant={
                          history.change_type === 'CREATE'
                            ? 'success'
                            : history.change_type === 'DELETE'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {history.change_type === 'CREATE'
                          ? '생성'
                          : history.change_type === 'DELETE'
                            ? '삭제'
                            : '수정'}
                      </Badge>
                      <span className="text-xs text-gray-500">버전 {history.version}</span>
                    </div>

                    <p className="text-sm font-medium text-gray-900 truncate">
                      {history.snapshot.name}
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(history.changed_at).toLocaleString('ko-KR')}
                      </div>
                      {(history.changed_by_name || history.changed_by) && (
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          {history.changed_by_name || history.changed_by}
                        </div>
                      )}
                    </div>

                    {/* Snapshot details */}
                    <details className="mt-3">
                      <summary className="text-xs text-[#7952B3] cursor-pointer hover:underline">
                        스냅샷 상세 보기
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-x-auto">
                        <pre>{JSON.stringify(history.snapshot, null, 2)}</pre>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
