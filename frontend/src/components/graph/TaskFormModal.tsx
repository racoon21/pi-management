import { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Badge } from '../shared/Badge';
import { useTaskStore } from '../../stores/taskStore';
import { useModalStore } from '../../stores/modalStore';
import { taskApi } from '../../api';
import type { TaskLevel, TaskGraphItem, TaskHistory } from '../../types/task';
import { Edit, Save, X, User, Building, Tag, Calendar, Sparkles, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const NEXT_LEVEL: Record<TaskLevel, TaskLevel | null> = {
  Root: 'L1',
  L1: 'L2',
  L2: 'L3',
  L3: 'L4',
  L4: null,
};

export const TaskFormModal = () => {
  const { isOpen, type, data, closeModal } = useModalStore();
  const { tasks, createTask, updateTask, selectedTask, fetchTasks } = useTaskStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');

  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    team: '',
    manager_name: '',
    manager_id: '',
    keywords: '',
    is_ai_utilized: false,
  });

  const isCreateMode = type === 'create';
  const parentTask = isCreateMode && data?.parentId
    ? tasks.find(t => t.id === data.parentId)
    : null;

  const [histories, setHistories] = useState<TaskHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && type === 'edit' && data?.taskId && activeTab === 'history') {
      setIsLoadingHistory(true);
      taskApi.getHistory(data.taskId)
        .then(setHistories)
        .catch((err) => console.error('Failed to fetch history:', err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [isOpen, type, data?.taskId, activeTab]);

  useEffect(() => {
    if (isOpen && type === 'create' && parentTask) {
      setFormData({
        name: '',
        organization: parentTask.organization,
        team: parentTask.team || '',
        manager_name: '',
        manager_id: '',
        keywords: parentTask.keywords?.join(', ') || '',
        is_ai_utilized: false,
      });
      setIsEditing(true);
    } else if (isOpen && type === 'edit' && selectedTask) {
      setFormData({
        name: selectedTask.name,
        organization: selectedTask.organization,
        team: selectedTask.team || '',
        manager_name: selectedTask.manager_name || '',
        manager_id: selectedTask.manager_id || '',
        keywords: selectedTask.keywords?.join(', ') || '',
        is_ai_utilized: selectedTask.is_ai_utilized,
      });
      setIsEditing(false);
      setActiveTab('detail');
    } else {
      setFormData({
        name: '',
        organization: '',
        team: '',
        manager_name: '',
        manager_id: '',
        keywords: '',
        is_ai_utilized: false,
      });
      setIsEditing(false);
    }
  }, [isOpen, type, parentTask, selectedTask]);

  if (!isOpen || (type !== 'create' && type !== 'edit')) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('업무명을 입력해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isCreateMode && parentTask) {
        const newLevel = NEXT_LEVEL[parentTask.level as TaskLevel];
        if (!newLevel) {
          toast.error('L4 노드에는 하위 업무를 추가할 수 없습니다');
          setIsSubmitting(false);
          return;
        }

        await createTask({
          parent_id: data.parentId,
          name: formData.name,
          organization: formData.organization,
          team: formData.team || null,
          manager_name: formData.manager_name || null,
          manager_id: formData.manager_id || null,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          is_ai_utilized: formData.is_ai_utilized,
        });

        toast.success('업무가 추가되었습니다');
        closeModal();
      } else if (type === 'edit' && data?.taskId) {
        await updateTask(data.taskId, {
          name: formData.name,
          organization: formData.organization,
          team: formData.team || null,
          manager_name: formData.manager_name || null,
          manager_id: formData.manager_id || null,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          is_ai_utilized: formData.is_ai_utilized,
        });
        toast.success('업무가 수정되었습니다');
        setIsEditing(false);
      }
    } catch (error) {
      toast.error('작업 중 오류가 발생했습니다');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setActiveTab('detail');
    closeModal();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isCreateMode ? '하위 업무 추가' : selectedTask?.name || '업무 상세'}
      size="lg"
    >
      {/* Create Mode */}
      {isCreateMode && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {parentTask && (
            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <p className="text-sm text-gray-500">
                상위 업무: <span className="font-medium text-gray-900">{parentTask.name}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                새 업무 레벨: {NEXT_LEVEL[parentTask.level as TaskLevel]}
              </p>
            </div>
          )}

          <Input
            label="업무명 *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="업무명을 입력하세요"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="조직"
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              placeholder="조직"
            />
            <Input
              label="팀"
              value={formData.team}
              onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              placeholder="팀"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="담당자"
              value={formData.manager_name}
              onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
              placeholder="담당자 이름"
            />
            <Input
              label="담당자 사번"
              value={formData.manager_id}
              onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
              placeholder="사번"
            />
          </div>

          <Input
            label="키워드"
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            placeholder="쉼표로 구분하여 입력"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ai_utilized_create"
              checked={formData.is_ai_utilized}
              onChange={(e) => setFormData({ ...formData, is_ai_utilized: e.target.checked })}
              className="w-4 h-4 text-[#7952B3] border-gray-300 rounded focus:ring-[#7952B3]"
            />
            <label htmlFor="ai_utilized_create" className="text-sm text-gray-700">
              AI 활용 업무
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              취소
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              추가
            </Button>
          </div>
        </form>
      )}

      {/* Edit/View Mode */}
      {type === 'edit' && selectedTask && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4 -mt-2">
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'detail'
                  ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              상세 정보
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              변경 이력 ({histories.length})
            </button>
          </div>

          {activeTab === 'detail' && (
            <>
              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="업무명 *"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="업무명을 입력하세요"
                    required
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="조직"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    />
                    <Input
                      label="팀"
                      value={formData.team}
                      onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="담당자"
                      value={formData.manager_name}
                      onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    />
                    <Input
                      label="담당자 사번"
                      value={formData.manager_id}
                      onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                    />
                  </div>

                  <Input
                    label="키워드"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    placeholder="쉼표로 구분하여 입력"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ai_utilized_edit"
                      checked={formData.is_ai_utilized}
                      onChange={(e) => setFormData({ ...formData, is_ai_utilized: e.target.checked })}
                      className="w-4 h-4 text-[#7952B3] border-gray-300 rounded focus:ring-[#7952B3]"
                    />
                    <label htmlFor="ai_utilized_edit" className="text-sm text-gray-700">
                      AI 활용 업무
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      icon={X}
                      onClick={() => setIsEditing(false)}
                    >
                      취소
                    </Button>
                    <Button type="submit" variant="primary" className="flex-1" icon={Save}>
                      저장
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* Header Info */}
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant={selectedTask.is_ai_utilized ? 'ai' : 'primary'}>
                      {selectedTask.level}
                    </Badge>
                    {selectedTask.is_ai_utilized && (
                      <Badge variant="ai">
                        <Sparkles size={12} className="mr-1" />
                        AI 활용
                      </Badge>
                    )}
                  </div>

                  {/* Info Items */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Building size={18} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">조직</p>
                        <p className="text-sm font-medium text-gray-900">{selectedTask.organization}</p>
                      </div>
                    </div>

                    {selectedTask.team && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Building size={18} className="text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">팀</p>
                          <p className="text-sm font-medium text-gray-900">{selectedTask.team}</p>
                        </div>
                      </div>
                    )}

                    {selectedTask.manager_name && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <User size={18} className="text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">담당자</p>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedTask.manager_name} ({selectedTask.manager_id})
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedTask.keywords && selectedTask.keywords.length > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Tag size={18} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 mb-2">키워드</p>
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

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar size={18} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">최종 수정일</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(selectedTask.updated_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Version Info */}
                  <div className="p-3 bg-[#7952B3]/10 rounded-lg text-center">
                    <p className="text-xs text-[#7952B3]">
                      버전 {selectedTask.version} · ID: {selectedTask.id.substring(0, 8)}...
                    </p>
                  </div>

                  {/* Edit Button */}
                  <Button
                    variant="primary"
                    className="w-full"
                    icon={Edit}
                    onClick={() => setIsEditing(true)}
                  >
                    수정하기
                  </Button>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {isLoadingHistory ? (
                <div className="text-center py-8 text-gray-500">
                  로딩 중...
                </div>
              ) : histories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  변경 이력이 없습니다
                </div>
              ) : (
                histories.map((history, index) => (
                  <div
                    key={history.id}
                    className={`p-4 rounded-lg border ${
                      index === 0 ? 'border-[#7952B3]/30 bg-[#7952B3]/10' : 'border-gray-200 bg-white'
                    }`}
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
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock size={12} />
                      {new Date(history.changed_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
};
