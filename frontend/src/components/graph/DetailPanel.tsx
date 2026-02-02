import { useState, useEffect } from 'react';
import { X, Edit, History, Save, XCircle, Sparkles, Calendar, User, Building, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import { useTaskStore } from '../../stores/taskStore';
import { useModalStore } from '../../stores/modalStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Badge } from '../shared/Badge';
import { taskApi } from '../../api';
import type { TaskHistory } from '../../types/task';
import toast from 'react-hot-toast';

export const DetailPanel = () => {
  const { selectedTask, selectedTaskId, selectTask, updateTask } = useTaskStore();
  const { openModal } = useModalStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');
  const [histories, setHistories] = useState<TaskHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (selectedTaskId && activeTab === 'history') {
      setIsLoadingHistory(true);
      taskApi.getHistory(selectedTaskId)
        .then(setHistories)
        .catch((err) => console.error('Failed to fetch history:', err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [selectedTaskId, activeTab]);

  if (!selectedTask) return null;

  const handleEdit = () => {
    setEditData({ ...selectedTask });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    openModal({
      type: 'confirm',
      title: '수정 취소',
      message: '변경 사항이 저장되지 않습니다. 취소하시겠습니까?',
      onConfirm: () => {
        setIsEditing(false);
        setEditData(null);
      },
    });
  };

  const handleSave = () => {
    openModal({
      type: 'confirm',
      title: '수정 확인',
      message: '변경 사항을 저장하시겠습니까?',
      onConfirm: () => {
        if (selectedTaskId && editData) {
          updateTask(selectedTaskId, editData);
          toast.success('업무가 수정되었습니다');
          setIsEditing(false);
          setEditData(null);
        }
      },
    });
  };

  const handleViewHistory = () => {
    setActiveTab('history');
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col animate-slideIn">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={selectedTask.is_ai_utilized ? 'ai' : 'primary'}>
            {selectedTask.level}
          </Badge>
          {selectedTask.is_ai_utilized && (
            <Badge variant="ai">
              <Sparkles size={12} className="mr-1" />
              AI
            </Badge>
          )}
        </div>
        <button
          onClick={() => selectTask(null)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('detail')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium transition-colors',
            activeTab === 'detail'
              ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          상세 정보
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium transition-colors',
            activeTab === 'history'
              ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          변경 이력 ({histories.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'detail' ? (
          isEditing ? (
            /* Edit Mode */
            <div className="space-y-4">
              <Input
                label="업무명"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
              <Input
                label="조직"
                value={editData.organization}
                onChange={(e) => setEditData({ ...editData, organization: e.target.value })}
              />
              <Input
                label="팀"
                value={editData.team || ''}
                onChange={(e) => setEditData({ ...editData, team: e.target.value })}
              />
              <Input
                label="담당자"
                value={editData.manager_name || ''}
                onChange={(e) => setEditData({ ...editData, manager_name: e.target.value })}
              />
              <Input
                label="담당자 사번"
                value={editData.manager_id || ''}
                onChange={(e) => setEditData({ ...editData, manager_id: e.target.value })}
              />
              <Input
                label="키워드 (쉼표로 구분)"
                value={editData.keywords?.join(', ') || ''}
                onChange={(e) => setEditData({
                  ...editData,
                  keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean)
                })}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_ai_utilized"
                  checked={editData.is_ai_utilized}
                  onChange={(e) => setEditData({ ...editData, is_ai_utilized: e.target.checked })}
                  className="w-4 h-4 text-[#7952B3] border-gray-300 rounded focus:ring-[#7952B3]"
                />
                <label htmlFor="is_ai_utilized" className="text-sm text-gray-700">
                  AI 활용 업무
                </label>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              {/* Name */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedTask.name}</h3>
              </div>

              {/* Info Grid */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">조직</p>
                    <p className="text-sm font-medium text-gray-900">{selectedTask.organization}</p>
                  </div>
                </div>

                {selectedTask.team && (
                  <div className="flex items-start gap-3">
                    <Building size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">팀</p>
                      <p className="text-sm font-medium text-gray-900">{selectedTask.team}</p>
                    </div>
                  </div>
                )}

                {selectedTask.manager_name && (
                  <div className="flex items-start gap-3">
                    <User size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">담당자</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedTask.manager_name} ({selectedTask.manager_id})
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">최종 수정일</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedTask.updated_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>

                {selectedTask.keywords && selectedTask.keywords.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Tag size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 mb-2">키워드</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedTask.keywords.map((keyword, index) => (
                          <Badge key={index} variant="default" size="sm">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Version Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">
                  버전 {selectedTask.version} · ID: {selectedTask.id.substring(0, 8)}...
                </p>
              </div>
            </div>
          )
        ) : (
          /* History Tab */
          <div className="space-y-4">
            {isLoadingHistory ? (
              <p className="text-sm text-gray-500 text-center py-8">로딩 중...</p>
            ) : histories.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">변경 이력이 없습니다.</p>
            ) : histories.map((history, index) => (
              <div
                key={history.id}
                className={clsx(
                  'p-4 rounded-lg border',
                  index === 0 ? 'border-[#7952B3] bg-[#7952B3]/5' : 'border-gray-200'
                )}
              >
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
                    {history.change_type === 'CREATE' ? '생성' : history.change_type === 'DELETE' ? '삭제' : '수정'}
                  </Badge>
                  <span className="text-xs text-gray-500">v{history.version}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {new Date(history.changed_at).toLocaleString('ko-KR')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {history.snapshot.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {activeTab === 'detail' && (
        <div className="px-6 py-4 border-t border-gray-200">
          {isEditing ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                icon={XCircle}
                onClick={handleCancelEdit}
              >
                취소
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                icon={Save}
                onClick={handleSave}
              >
                저장
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                icon={History}
                onClick={handleViewHistory}
              >
                이력
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                icon={Edit}
                onClick={handleEdit}
              >
                수정
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
