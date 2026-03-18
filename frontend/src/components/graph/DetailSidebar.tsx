import { useState, useEffect } from 'react';
import { X, Edit, Trash2, Plus, User, Building, Tag, Calendar, Sparkles, Clock, Save, ChevronRight } from 'lucide-react';
import { useTaskStore } from '../../stores/taskStore';
import { useModalStore } from '../../stores/modalStore';
import { useAuthStore } from '../../stores/authStore';
import { permissions } from '../../utils/permissions';
import { taskApi } from '../../api';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { Input } from '../shared/Input';
import type { TaskLevel, TaskHistory, TaskGraphItem, OrganizationType } from '../../types/task';
import toast from 'react-hot-toast';

const NEXT_LEVEL: Record<TaskLevel, TaskLevel | null> = {
  Root: 'L1', L1: 'L2', L2: 'L3', L3: 'L4', L4: null,
};

const ORG_TYPES: OrganizationType[] = ['본부', '실', '담당', '팀'];

const levelStyles: Record<TaskLevel, { bg: string; text: string; style?: React.CSSProperties }> = {
  Root: { bg: '', text: 'text-white', style: { backgroundColor: '#8E72EE' } },
  L1: { bg: '', text: 'text-white', style: { backgroundColor: '#00D7D2' } },
  L2: { bg: '', text: 'text-white', style: { backgroundColor: '#191927' } },
  L3: { bg: '', text: 'text-white', style: { backgroundColor: '#7259D9' } },
  L4: { bg: '', text: 'text-gray-700', style: { backgroundColor: '#E4E3EC' } },
};

export const DetailSidebar = () => {
  const { selectedTask, selectedTaskId, selectTask, deleteTask, updateTask } = useTaskStore();
  const { openModal } = useModalStore();
  const authUser = useAuthStore((s) => s.user);
  const canEdit = permissions.canEditTask(authUser);
  const canDelete = permissions.canDeleteTask(authUser);
  const [activeTab, setActiveTab] = useState<'detail' | 'history'>('detail');
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // [IMP-03] 인라인 편집 상태
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', organization: '', organization_type: '' as string,
    team: '', manager_name: '', manager_id: '', keywords: '',
    is_ai_utilized: false,
  });

  // [IMP-07] 삭제 확인용 하위 노드
  const [descendants, setDescendants] = useState<TaskGraphItem[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (selectedTaskId && activeTab === 'history') {
      setIsLoadingHistory(true);
      taskApi.getHistory(selectedTaskId)
        .then(setHistory)
        .catch((err) => console.error('Failed to fetch history:', err))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [selectedTaskId, activeTab]);

  // 다른 노드 선택 시 편집 모드 리셋
  useEffect(() => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
  }, [selectedTaskId]);

  if (!selectedTask || !selectedTaskId) return null;

  const nextLevel = NEXT_LEVEL[selectedTask.level as TaskLevel];
  const style = levelStyles[selectedTask.level as TaskLevel] || levelStyles.L4;
  const isL1 = selectedTask.level === 'L1';
  const isL4 = selectedTask.level === 'L4';

  const enterEditMode = () => {
    setFormData({
      name: selectedTask.name,
      organization: selectedTask.organization,
      organization_type: selectedTask.organization_type || '',
      team: selectedTask.team || '',
      manager_name: selectedTask.manager_name || '',
      manager_id: selectedTask.manager_id || '',
      keywords: selectedTask.keywords?.join(', ') || '',
      is_ai_utilized: selectedTask.is_ai_utilized,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('업무명을 입력해주세요'); return; }
    setIsSaving(true);
    try {
      await updateTask(selectedTaskId, {
        name: formData.name,
        organization: isL1 ? formData.name : formData.organization,
        organization_type: (formData.organization_type || null) as OrganizationType | null,
        team: formData.team || null,
        manager_name: formData.manager_name || null,
        manager_id: formData.manager_id || null,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
        is_ai_utilized: isL4 ? formData.is_ai_utilized : false,
      });
      toast.success('업무가 수정되었습니다');
      setIsEditing(false);
    } catch { toast.error('수정 중 오류가 발생했습니다'); }
    finally { setIsSaving(false); }
  };

  const handleDeleteClick = async () => {
    try {
      const desc = await taskApi.getDescendants(selectedTaskId);
      setDescendants(desc);
      setShowDeleteConfirm(true);
    } catch { toast.error('하위 노드 조회 실패'); }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteTask(selectedTaskId);
      toast.success('업무가 삭제되었습니다');
      setShowDeleteConfirm(false);
    } catch { toast.error('삭제 중 오류가 발생했습니다'); }
  };

  const handleAddChild = () => {
    if (nextLevel) {
      openModal({ type: 'create', title: '하위 업무 추가', data: { parentId: selectedTaskId, level: nextLevel } });
    }
  };

  // [IMP-07] 삭제 확인 뷰
  if (showDeleteConfirm) {
    return (
      <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-red-600">업무 삭제 확인</h3>
          <button onClick={() => setShowDeleteConfirm(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-700 mb-3">
            <strong>"{selectedTask.name}"</strong> 업무를 삭제하시겠습니까?
          </p>
          {descendants.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-sm font-medium text-red-700 mb-2">
                하위 {descendants.length}개 업무가 함께 삭제됩니다:
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {descendants.map((d) => (
                  <div key={d.id} className="flex items-center gap-1.5 text-xs text-red-600">
                    <ChevronRight size={10} />
                    <Badge variant="danger" size="sm">{d.level}</Badge>
                    <span className="truncate">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500">이 작업은 되돌릴 수 없습니다.</p>
        </div>
        <div className="p-4 border-t border-gray-200 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>취소</Button>
          <Button variant="danger" className="flex-1" icon={Trash2} onClick={handleDeleteConfirm}>삭제</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${style.text}`} style={style.style}>
            {selectedTask.level}
          </span>
          <button onClick={() => selectTask(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>
        <h3 className="font-semibold text-gray-900 leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all' }} title={selectedTask.name}>
          {selectedTask.name}
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab('detail')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'detail' ? 'text-[#7952B3] border-b-2 border-[#7952B3]' : 'text-gray-500 hover:text-gray-700'}`}>
          상세 정보
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-[#7952B3] border-b-2 border-[#7952B3]' : 'text-gray-500 hover:text-gray-700'}`}>
          변경 이력
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'detail' ? (
          isEditing ? (
            /* [IMP-03] 인라인 편집 폼 */
            <div className="space-y-3">
              <Input label="업무명 *" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value, ...(isL1 ? { organization: e.target.value } : {}) })} />

              {/* [IMP-04] 조직 단위 드롭다운 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">조직 단위</label>
                <select value={formData.organization_type}
                  onChange={(e) => setFormData({ ...formData, organization_type: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7952B3]">
                  <option value="">선택 없음</option>
                  {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* [IMP-05] L1이면 조직명 읽기전용 */}
              <Input label="조직명" value={isL1 ? formData.name : formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                disabled={isL1} />

              <Input label="팀" value={formData.team}
                onChange={(e) => setFormData({ ...formData, team: e.target.value })} />

              <div className="grid grid-cols-2 gap-3">
                <Input label="담당자" value={formData.manager_name}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })} />
                <Input label="사번" value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })} />
              </div>

              <Input label="키워드" value={formData.keywords} placeholder="쉼표로 구분"
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })} />

              {/* [IMP-06] L4만 AI 체크박스 */}
              {isL4 && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ai_edit" checked={formData.is_ai_utilized}
                    onChange={(e) => setFormData({ ...formData, is_ai_utilized: e.target.checked })}
                    className="w-4 h-4 text-[#7952B3] border-gray-300 rounded focus:ring-[#7952B3]" />
                  <label htmlFor="ai_edit" className="text-sm text-gray-700">AI 활용 업무</label>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" icon={X} onClick={() => setIsEditing(false)}>취소</Button>
                <Button variant="primary" className="flex-1" icon={Save} onClick={handleSave} loading={isSaving}>저장</Button>
              </div>
            </div>
          ) : (
            /* 읽기 전용 뷰 */
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Building size={18} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">조직</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedTask.organization}
                      {selectedTask.organization_type && ` (${selectedTask.organization_type})`}
                    </p>
                  </div>
                </div>

                {selectedTask.manager_name && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <User size={18} className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">담당자</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedTask.manager_name}{selectedTask.manager_id && ` (${selectedTask.manager_id})`}
                      </p>
                    </div>
                  </div>
                )}

                {/* [IMP-06] L4만 AI 활용 표시 */}
                {isL4 && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Sparkles size={18} className={selectedTask.is_ai_utilized ? 'text-purple-500' : 'text-gray-400'} />
                    <div>
                      <p className="text-xs text-gray-500">AI 활용</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedTask.is_ai_utilized ? '활용 중' : '미활용'}
                      </p>
                    </div>
                  </div>
                )}

                {selectedTask.keywords && selectedTask.keywords.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag size={18} className="text-gray-400" />
                      <p className="text-xs text-gray-500">키워드</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedTask.keywords.map((keyword, idx) => (
                        <Badge key={idx} variant="default" size="sm">{keyword}</Badge>
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
          )
        ) : (
          <div className="space-y-3">
            {isLoadingHistory ? (
              <p className="text-sm text-gray-500 text-center py-8">로딩 중...</p>
            ) : history.length > 0 ? (
              history.map((item, idx) => (
                <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{new Date(item.changed_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-1">{item.change_type}</p>
                  <p className="text-xs text-gray-500">변경자: {item.changed_by_name || item.changed_by || '알 수 없음'}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">변경 이력이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isEditing && activeTab === 'detail' && (canEdit || canDelete) && (
        <div className="p-4 border-t border-gray-200 space-y-2">
          {canEdit && nextLevel && (
            <Button variant="primary" className="w-full" icon={Plus} onClick={handleAddChild}>
              하위 업무 추가 ({nextLevel})
            </Button>
          )}
          <div className="flex gap-2">
            {canEdit && (
              <Button variant="secondary" className="flex-1" icon={Edit} onClick={enterEditMode}>수정</Button>
            )}
            {canDelete && selectedTask.level !== 'Root' && (
              <Button variant="danger" className="flex-1" icon={Trash2} onClick={handleDeleteClick}>삭제</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
