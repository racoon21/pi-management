import { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Badge } from '../shared/Badge';
import { useTaskStore } from '../../stores/taskStore';
import { useModalStore } from '../../stores/modalStore';
import { useAuthStore } from '../../stores/authStore';
import { taskApi } from '../../api';
import { permissions } from '../../utils/permissions';
import type { TaskLevel, TaskHistory, OrganizationType, TaskGraphItem } from '../../types/task';
import { Edit, Save, X, User, Users, Building, Tag, Calendar, Sparkles, Clock, Plus, Trash2, Link2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const ORG_TYPES: OrganizationType[] = ['본부', '실', '담당', '팀'];

const NEXT_LEVEL: Record<TaskLevel, TaskLevel | null> = {
  Root: 'L1',
  L1: 'L2',
  L2: 'L3',
  L3: 'L4',
  L4: null,
};

export const TaskFormModal = () => {
  const { isOpen, type, data, closeModal, openModal } = useModalStore();
  const { tasks, createTask, updateTask, deleteTask, selectedTask } = useTaskStore();
  const { user } = useAuthStore();
  const canEdit = permissions.canEditTask(user);
  const canDelete = permissions.canDeleteTask(user);
  const [, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');

  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    organization_type: '' as string,
    team: '',
    manager_name: '',
    manager_id: '',
    related_team: '',
    keywords: '',
    is_ai_utilized: false,
  });

  const isCreateMode = type === 'create';
  const parentTask = isCreateMode && data?.parentId
    ? tasks.find(t => t.id === data.parentId)
    : null;

  const [histories, setHistories] = useState<TaskHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 연결 업무 상태
  const [relations, setRelations] = useState<TaskGraphItem[]>([]);
  const [relationSearch, setRelationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<TaskGraphItem[]>([]);
  const [_isSearching, setIsSearching] = useState(false);

  // 연결 업무 로드
  useEffect(() => {
    if (isOpen && type === 'edit' && data?.taskId) {
      taskApi.getRelations(data.taskId)
        .then(setRelations)
        .catch(() => setRelations([]));
    } else {
      setRelations([]);
    }
  }, [isOpen, type, data?.taskId]);

  // 연결 업무 검색 (디바운스)
  useEffect(() => {
    if (!relationSearch.trim() || relationSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await taskApi.searchTasks(relationSearch);
        // 자기 자신과 이미 연결된 것 제외
        const currentId = data?.taskId;
        const relatedIds = new Set(relations.map(r => r.id));
        setSearchResults(results.filter(r => r.id !== currentId && !relatedIds.has(r.id)).slice(0, 5));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [relationSearch, data?.taskId, relations]);

  useEffect(() => {
    if (isOpen && type === 'edit' && data?.taskId && activeTab === 'history') {
      setIsLoadingHistory(true);
      taskApi.getHistory(data.taskId)
        .then(setHistories)
        .catch((err) => console.error('Failed to fetch history:', err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [isOpen, type, data?.taskId, activeTab]);

  // [IMP-05] 생성 시 새 노드의 레벨 계산
  const newLevel = parentTask ? NEXT_LEVEL[parentTask.level as TaskLevel] : null;
  const isNewL1 = newLevel === 'L1';
  // [IMP-06] L4일 때만 AI 체크박스 표시
  const isNewL4 = newLevel === 'L4';
  // L3/L4만 유관팀 필드 표시
  const showRelatedTeam = newLevel === 'L3' || newLevel === 'L4';

  useEffect(() => {
    if (isOpen && type === 'create' && parentTask) {
      setFormData({
        name: '',
        organization: parentTask.organization,
        organization_type: parentTask.organization_type || '',
        team: parentTask.team || '',
        manager_name: '',
        manager_id: '',
        related_team: '',
        keywords: parentTask.keywords?.join(', ') || '',
        is_ai_utilized: false,
      });
      setIsEditing(true);
    } else if (isOpen && type === 'edit' && selectedTask) {
      setFormData({
        name: selectedTask.name,
        organization: selectedTask.organization,
        organization_type: selectedTask.organization_type || '',
        team: selectedTask.team || '',
        manager_name: selectedTask.manager_name || '',
        manager_id: selectedTask.manager_id || '',
        related_team: selectedTask.related_team?.join(', ') || '',
        keywords: selectedTask.keywords?.join(', ') || '',
        is_ai_utilized: selectedTask.is_ai_utilized,
      });
      setIsEditing(false);
      setActiveTab('detail');
    } else {
      setFormData({
        name: '',
        organization: '',
        organization_type: '',
        team: '',
        manager_name: '',
        manager_id: '',
        related_team: '',
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
          // [IMP-05] L1이면 조직명 = 업무명
          organization: isNewL1 ? formData.name : formData.organization,
          organization_type: (formData.organization_type || null) as OrganizationType | null,
          team: formData.team || null,
          manager_name: formData.manager_name || null,
          manager_id: formData.manager_id || null,
          related_team: showRelatedTeam ? formData.related_team.split(',').map(t => t.trim()).filter(Boolean) : null,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          // [IMP-06] L4만 AI 활용 설정 가능
          is_ai_utilized: isNewL4 ? formData.is_ai_utilized : false,
        });

        toast.success('업무가 추가되었습니다');
        closeModal();
      } else if (type === 'edit' && data?.taskId) {
        await updateTask(data.taskId, {
          name: formData.name,
          organization: formData.organization,
          organization_type: (formData.organization_type || null) as OrganizationType | null,
          team: formData.team || null,
          manager_name: formData.manager_name || null,
          manager_id: formData.manager_id || null,
          related_team: formData.related_team.split(',').map(t => t.trim()).filter(Boolean),
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

  const handleAddRelation = async (relatedId: string) => {
    if (!data?.taskId) return;
    try {
      await taskApi.addRelation(data.taskId, relatedId);
      const updated = await taskApi.getRelations(data.taskId);
      setRelations(updated);
      setRelationSearch('');
      setSearchResults([]);
      toast.success('연결 업무가 추가되었습니다');
    } catch {
      toast.error('연결 추가에 실패했습니다');
    }
  };

  const handleRemoveRelation = async (relatedId: string) => {
    if (!data?.taskId) return;
    try {
      await taskApi.removeRelation(data.taskId, relatedId);
      setRelations(prev => prev.filter(r => r.id !== relatedId));
      toast.success('연결이 해제되었습니다');
    } catch {
      toast.error('연결 해제에 실패했습니다');
    }
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
            <div className="p-3 bg-[#1E1E2A] rounded-lg mb-4">
              <p className="text-sm text-gray-400">
                상위 업무: <span className="font-medium text-white">{parentTask.name}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                새 업무 레벨: {NEXT_LEVEL[parentTask.level as TaskLevel]}
              </p>
            </div>
          )}

          <Input
            label="업무명 *"
            value={formData.name}
            onChange={(e) => setFormData({
              ...formData,
              name: e.target.value,
              // [IMP-05] L1이면 조직명 자동 동기화
              ...(isNewL1 ? { organization: e.target.value } : {}),
            })}
            placeholder="업무명을 입력하세요"
            required
          />

          {/* [IMP-04] 조직 단위 드롭다운 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-400">조직 단위</label>
            <select
              value={formData.organization_type}
              onChange={(e) => setFormData({ ...formData, organization_type: e.target.value })}
              className="px-3 py-2 bg-[#1E1E2A] border border-border rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-0 focus:border-white focus:border-2"
            >
              <option value="">선택 없음</option>
              {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* [IMP-05] L1이면 조직명 읽기전용 */}
            <Input
              label="조직"
              value={isNewL1 ? formData.name : formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              placeholder="조직"
              disabled={isNewL1}
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

          {showRelatedTeam && (
            <Input
              label="유관팀"
              value={formData.related_team}
              onChange={(e) => setFormData({ ...formData, related_team: e.target.value })}
              placeholder="쉼표로 구분하여 입력 (예: 보안팀, QA팀)"
            />
          )}

          <Input
            label="키워드"
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            placeholder="쉼표로 구분하여 입력"
          />

          {/* [IMP-06] L4일 때만 AI 체크박스 표시 */}
          {isNewL4 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ai_utilized_create"
                checked={formData.is_ai_utilized}
                onChange={(e) => setFormData({ ...formData, is_ai_utilized: e.target.checked })}
                className="w-4 h-4 text-[#7952B3] border-border rounded focus:ring-[#7952B3]"
              />
              <label htmlFor="ai_utilized_create" className="text-sm text-gray-300">
                AI 활용 업무
              </label>
            </div>
          )}

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
          <div className="flex border-b border-border mb-4 -mt-2">
            <button
              onClick={() => setActiveTab('detail')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'detail'
                  ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              상세 정보
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-[#7952B3] border-b-2 border-[#7952B3]'
                  : 'text-gray-400 hover:text-gray-300'
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

                  {selectedTask && (selectedTask.level === 'L3' || selectedTask.level === 'L4') && (
                    <Input
                      label="유관팀"
                      value={formData.related_team}
                      onChange={(e) => setFormData({ ...formData, related_team: e.target.value })}
                      placeholder="쉼표로 구분하여 입력 (예: 보안팀, QA팀)"
                    />
                  )}

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
                      className="w-4 h-4 text-[#7952B3] border-border rounded focus:ring-[#7952B3]"
                    />
                    <label htmlFor="ai_utilized_edit" className="text-sm text-gray-300">
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
                    <div className="flex items-center gap-3 p-3 bg-[#1E1E2A] rounded-lg">
                      <Building size={18} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">조직</p>
                        <p className="text-sm font-medium text-white">{selectedTask.organization}</p>
                      </div>
                    </div>

                    {selectedTask.team && (
                      <div className="flex items-center gap-3 p-3 bg-[#1E1E2A] rounded-lg">
                        <Building size={18} className="text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">팀</p>
                          <p className="text-sm font-medium text-white">{selectedTask.team}</p>
                        </div>
                      </div>
                    )}

                    {(selectedTask.level === 'L3' || selectedTask.level === 'L4') && (
                      <div className="flex items-start gap-3 p-3 bg-[#1E1E2A] rounded-lg">
                        <Users size={18} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-400 mb-2">유관팀</p>
                          {selectedTask.related_team && selectedTask.related_team.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedTask.related_team.map((team, index) => (
                                <Badge key={index} variant="default" size="sm">
                                  {team}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">-</p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTask.manager_name && (
                      <div className="flex items-center gap-3 p-3 bg-[#1E1E2A] rounded-lg">
                        <User size={18} className="text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">담당자</p>
                          <p className="text-sm font-medium text-white">
                            {selectedTask.manager_name} ({selectedTask.manager_id})
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedTask.keywords && selectedTask.keywords.length > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-[#1E1E2A] rounded-lg">
                        <Tag size={18} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-400 mb-2">키워드</p>
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

                    {/* 연결 업무 */}
                    <div className="flex items-start gap-3 p-3 bg-[#1E1E2A] rounded-lg">
                      <Link2 size={18} className="text-gray-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-2">연결 업무</p>
                        {relations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {relations.map((rel) => (
                              <span
                                key={rel.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#2A2A35] rounded text-xs text-gray-300"
                              >
                                <span className="text-[10px] text-gray-500">{rel.level}</span>
                                <span className="truncate max-w-[120px]">{rel.name}</span>
                                <button
                                  onClick={() => handleRemoveRelation(rel.id)}
                                  className="text-gray-500 hover:text-red-400 ml-0.5"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">-</p>
                        )}
                        {/* 연결 업무 추가 검색 */}
                        <div className="relative mt-2">
                          <div className="flex items-center gap-1">
                            <Search size={14} className="text-gray-500" />
                            <input
                              type="text"
                              value={relationSearch}
                              onChange={(e) => setRelationSearch(e.target.value)}
                              placeholder="업무명으로 검색하여 연결..."
                              className="flex-1 bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none"
                            />
                          </div>
                          {searchResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-10 max-h-[150px] overflow-y-auto">
                              {searchResults.map((result) => (
                                <button
                                  key={result.id}
                                  onClick={() => handleAddRelation(result.id)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#2A2A35] transition-colors flex items-center gap-2"
                                >
                                  <span className="text-[10px] text-gray-500 shrink-0">{result.level}</span>
                                  <span className="text-gray-300 truncate">{result.name}</span>
                                  <span className="text-[10px] text-gray-600 shrink-0">{result.organization}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-[#1E1E2A] rounded-lg">
                      <Calendar size={18} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">최종 수정일</p>
                        <p className="text-sm font-medium text-white">
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

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {canEdit && (
                      <Button
                        variant="primary"
                        className="flex-1 min-w-[120px]"
                        icon={Edit}
                        onClick={() => setIsEditing(true)}
                      >
                        수정하기
                      </Button>
                    )}

                    {canEdit && NEXT_LEVEL[selectedTask.level] !== null && (
                      <Button
                        variant="secondary"
                        className="flex-1 min-w-[120px]"
                        icon={Plus}
                        onClick={() => {
                          closeModal();
                          setTimeout(() => {
                            openModal({
                              type: 'create',
                              title: '하위 업무 추가',
                              data: { parentId: selectedTask.id },
                            });
                          }, 200);
                        }}
                      >
                        하위 업무 추가
                      </Button>
                    )}
                  </div>

                  {canDelete && selectedTask.level !== 'Root' && (
                    <Button
                      variant="danger"
                      className="w-full"
                      icon={Trash2}
                      onClick={async () => {
                        if (!confirm(`"${selectedTask.name}" 태스크를 삭제하시겠습니까?`)) return;
                        try {
                          await deleteTask(selectedTask.id);
                          toast.success('삭제되었습니다');
                          closeModal();
                        } catch {
                          toast.error('삭제에 실패했습니다');
                        }
                      }}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {isLoadingHistory ? (
                <div className="text-center py-8 text-gray-400">
                  로딩 중...
                </div>
              ) : histories.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  변경 이력이 없습니다
                </div>
              ) : (
                histories.map((history, index) => (
                  <div
                    key={history.id}
                    className={`p-4 rounded-lg border ${
                      index === 0 ? 'border-[#7952B3]/30 bg-[#7952B3]/10' : 'border-border bg-card'
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
                      <span className="text-xs text-gray-400">v{history.version}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
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
