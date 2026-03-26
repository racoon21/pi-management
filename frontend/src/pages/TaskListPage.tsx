import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building,
  User,
  Users,
  Tag,
  Sparkles,
  ChevronsUpDown,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTaskStore } from '../stores/taskStore';
import { useAuthStore } from '../stores/authStore';
import { useModalStore } from '../stores/modalStore';
import { permissions } from '../utils/permissions';
import { Badge } from '../components/shared/Badge';
import toast from 'react-hot-toast';
import type { TaskGraphItem, OrganizationType } from '../types/task';

/* ── helpers ─────────────────────────────────────── */

const LEVEL_COLORS: Record<string, string> = {
  L1: 'border-l-[#00D7D2]',
  L2: 'border-l-[#191927]',
  L3: 'border-l-[#7259D9]',
  L4: 'border-l-[#E4E3EC]',
};

const LEVEL_INDENT: Record<string, number> = { L1: 0, L2: 1, L3: 2, L4: 3 };

const ORG_TYPES: OrganizationType[] = ['본부', '실', '담당', '팀'];

const NEXT_LEVEL: Record<string, string | null> = {
  Root: 'L1', L1: 'L2', L2: 'L3', L3: 'L4', L4: null,
};

interface TreeNode extends TaskGraphItem {
  children: TreeNode[];
}

function buildTree(tasks: TaskGraphItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const t of tasks) map.set(t.id, { ...t, children: [] });
  for (const t of tasks) {
    const node = map.get(t.id)!;
    if (t.parent_id && map.has(t.parent_id)) {
      map.get(t.parent_id)!.children.push(node);
    } else if (t.level !== 'Root') {
      roots.push(node);
    }
  }
  return roots;
}

function filterTree(
  nodes: TreeNode[],
  predicate: (t: TaskGraphItem) => boolean,
): TreeNode[] {
  return nodes
    .map((node) => {
      const fc = filterTree(node.children, predicate);
      if (predicate(node) || fc.length > 0) return { ...node, children: fc };
      return null;
    })
    .filter(Boolean) as TreeNode[];
}

/* ── inline edit form ────────────────────────────── */

interface EditFormData {
  name: string;
  organization: string;
  organization_type: string;
  team: string;
  manager_name: string;
  manager_id: string;
  related_team: string;
  keywords: string;
  is_ai_utilized: boolean;
}

function taskToForm(t: TaskGraphItem): EditFormData {
  return {
    name: t.name,
    organization: t.organization,
    organization_type: t.organization_type || '',
    team: t.team || '',
    manager_name: t.manager_name || '',
    manager_id: t.manager_id || '',
    related_team: t.related_team?.join(', ') || '',
    keywords: t.keywords?.join(', ') || '',
    is_ai_utilized: t.is_ai_utilized,
  };
}

/* ── component ───────────────────────────────────── */

export const TaskListPage = () => {
  const { tasks, fetchTasks, updateTask, deleteTask, isLoading } = useTaskStore();
  const { user } = useAuthStore();
  const { openModal } = useModalStore();
  const canEdit = permissions.canEditTask(user);
  const canDelete = permissions.canDeleteTask(user);

  const [orgFilter, setOrgFilter] = useState('');
  const [aiFilter, setAiFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditFormData | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchTasks(true); }, [fetchTasks]);

  // Auto-expand L1
  useEffect(() => {
    if (tasks.length > 0 && expanded.size === 0) {
      setExpanded(new Set(tasks.filter((t) => t.level === 'L1').map((t) => t.id)));
    }
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus name input on edit start
  useEffect(() => {
    if (editingId && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [editingId]);

  const organizations = useMemo(() => {
    const orgs = new Set(tasks.filter((t) => t.level === 'L1').map((t) => t.organization));
    return Array.from(orgs).sort();
  }, [tasks]);

  const tree = useMemo(() => buildTree(tasks.filter((t) => t.level !== 'Root')), [tasks]);

  const filteredTree = useMemo(() => {
    const preds: ((t: TaskGraphItem) => boolean)[] = [];
    if (orgFilter) preds.push((t) => t.organization === orgFilter);
    if (aiFilter === 'true') preds.push((t) => t.is_ai_utilized);
    if (aiFilter === 'false') preds.push((t) => !t.is_ai_utilized);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      preds.push((t) =>
        t.name.toLowerCase().includes(q) ||
        t.organization.toLowerCase().includes(q) ||
        (t.team?.toLowerCase().includes(q) ?? false) ||
        (t.manager_name?.toLowerCase().includes(q) ?? false) ||
        (t.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false),
      );
    }
    if (preds.length === 0) return tree;
    return filterTree(tree, (t) => preds.every((p) => p(t)));
  }, [tree, orgFilter, aiFilter, searchQuery]);

  const totalVisible = useMemo(() => {
    const count = (ns: TreeNode[]): number => ns.reduce((s, n) => s + 1 + count(n.children), 0);
    return count(filteredTree);
  }, [filteredTree]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(tasks.filter((t) => t.level !== 'Root' && t.level !== 'L4').map((t) => t.id)));
  }, [tasks]);

  const collapseAll = useCallback(() => { setExpanded(new Set()); }, []);

  /* ── edit handlers ─────────────────────────────── */

  const startEdit = useCallback((task: TaskGraphItem) => {
    if (!canEdit) return;
    setEditingId(task.id);
    setForm(taskToForm(task));
  }, [canEdit]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setForm(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !form) return;
    try {
      const task = tasks.find((t) => t.id === editingId);
      const showRelated = task && (task.level === 'L3' || task.level === 'L4');
      await updateTask(editingId, {
        name: form.name,
        organization: form.organization,
        organization_type: (form.organization_type || null) as OrganizationType | null,
        team: form.team || null,
        manager_name: form.manager_name || null,
        manager_id: form.manager_id || null,
        related_team: showRelated ? form.related_team.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        keywords: form.keywords.split(',').map((s) => s.trim()).filter(Boolean),
        is_ai_utilized: form.is_ai_utilized,
      });
      toast.success('저장되었습니다');
      cancelEdit();
    } catch {
      toast.error('저장에 실패했습니다');
    }
  }, [editingId, form, tasks, updateTask, cancelEdit]);

  const handleDelete = useCallback(async (task: TaskGraphItem) => {
    if (!canDelete) return;
    if (!confirm(`"${task.name}" 태스크를 삭제하시겠습니까?`)) return;
    try {
      await deleteTask(task.id);
      toast.success('삭제되었습니다');
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  }, [canDelete, deleteTask]);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') cancelEdit();
    if (e.key === 'Enter' && e.ctrlKey) saveEdit();
  };

  /* ── row renderers ─────────────────────────────── */

  const renderEditRow = (node: TreeNode) => {
    if (!form) return null;
    const indent = LEVEL_INDENT[node.level] ?? 0;
    const levelColor = LEVEL_COLORS[node.level] || 'border-l-gray-600';
    const showRelated = node.level === 'L3' || node.level === 'L4';

    return (
      <div
        key={node.id}
        className={clsx('border-b border-primary/30 bg-primary/5 border-l-3', levelColor)}
        style={{ paddingLeft: `${indent * 28 + 16}px` }}
        onKeyDown={handleEditKeyDown}
      >
        <div className="px-4 py-3 space-y-3">
          {/* Row 1: name */}
          <div className="flex items-center gap-2">
            <Badge
              variant={node.level === 'L1' ? 'success' : node.level === 'L2' ? 'warning' : node.level === 'L3' ? 'primary' : 'default'}
              size="sm"
            >
              {node.level}
            </Badge>
            <input
              ref={nameRef}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-sm text-white focus:border-primary focus:outline-none"
              placeholder="업무명"
            />
          </div>

          {/* Row 2: org, org_type, team */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-500"><Building size={12} /></div>
            <input
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              className="bg-input border border-border rounded px-2 py-1 text-xs text-white focus:border-primary focus:outline-none w-28"
              placeholder="조직"
            />
            <select
              value={form.organization_type}
              onChange={(e) => setForm({ ...form, organization_type: e.target.value })}
              className="bg-input border border-border rounded px-2 py-1 text-xs text-white focus:border-primary focus:outline-none"
            >
              <option value="">단위</option>
              {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
              className="bg-input border border-border rounded px-2 py-1 text-xs text-white focus:border-primary focus:outline-none w-24"
              placeholder="팀"
            />
          </div>

          {/* Row 3: manager, keywords */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-500"><User size={12} /></div>
            <input
              value={form.manager_name}
              onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
              className="bg-input border border-border rounded px-2 py-1 text-xs text-white focus:border-primary focus:outline-none w-24"
              placeholder="담당자"
            />
            <input
              value={form.manager_id}
              onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
              className="bg-input border border-border rounded px-2 py-1 text-xs text-white focus:border-primary focus:outline-none w-20"
              placeholder="사번"
            />
            <div className="flex items-center gap-1 text-xs text-gray-500 ml-2"><Tag size={12} /></div>
            <input
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              className="bg-input border border-border rounded px-2 py-1 text-xs text-white focus:border-primary focus:outline-none flex-1"
              placeholder="키워드 (쉼표 구분)"
            />
          </div>

          {/* Row 4: related_team (L3/L4), AI, actions */}
          <div className="flex items-center gap-2">
            {showRelated && (
              <>
                <div className="flex items-center gap-1 text-xs text-gray-500"><Users size={12} /></div>
                <input
                  value={form.related_team}
                  onChange={(e) => setForm({ ...form, related_team: e.target.value })}
                  className="bg-input border border-border rounded px-2 py-1 text-xs text-white focus:border-primary focus:outline-none w-48"
                  placeholder="유관팀 (쉼표 구분)"
                />
              </>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_ai_utilized}
                onChange={(e) => setForm({ ...form, is_ai_utilized: e.target.checked })}
                className="w-3.5 h-3.5 text-primary border-border rounded focus:ring-primary"
              />
              <Sparkles size={12} />
              AI 활용
            </label>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={saveEdit}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-primary hover:bg-primary-dark rounded transition-colors"
              >
                <Check size={12} /> 저장
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-surface border border-border rounded transition-colors"
              >
                <X size={12} /> 취소
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-600">Ctrl+Enter로 저장 · Escape로 취소</p>
        </div>
      </div>
    );
  };

  const renderViewRow = (node: TreeNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const indent = LEVEL_INDENT[node.level] ?? 0;
    const levelColor = LEVEL_COLORS[node.level] || 'border-l-gray-600';

    return (
      <div
        className={clsx(
          'flex items-center gap-2 px-4 py-2.5 border-b border-border/30 hover:bg-surface/60 transition-colors group border-l-3',
          levelColor,
        )}
        style={{ paddingLeft: `${indent * 28 + 16}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => hasChildren && toggleExpand(node.id)}
          className={clsx(
            'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors',
            hasChildren ? 'text-gray-400 hover:text-white hover:bg-surface' : 'text-transparent',
          )}
        >
          {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5" />}
        </button>

        {/* Level badge */}
        <Badge
          variant={node.level === 'L1' ? 'success' : node.level === 'L2' ? 'warning' : node.level === 'L3' ? 'primary' : 'default'}
          size="sm"
        >
          {node.level}
        </Badge>

        {/* Name */}
        <span className="font-medium text-sm text-white truncate min-w-0 flex-shrink" title={node.name}>
          {node.name}
        </span>

        {/* AI badge */}
        {node.is_ai_utilized && (
          <Badge variant="ai" size="sm">
            <Sparkles size={10} className="mr-0.5" />AI
          </Badge>
        )}

        <span className="flex-1" />

        {/* Right-side info */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
          <span className="flex items-center gap-1 w-28 truncate" title={node.organization}>
            <Building size={12} className="flex-shrink-0" />
            {node.organization}
          </span>

          {node.team && (
            <span className="flex items-center gap-1 w-24 truncate" title={node.team}>
              <Users size={12} className="flex-shrink-0" />
              {node.team}
            </span>
          )}

          {node.manager_name && (
            <span className="flex items-center gap-1 w-24 truncate" title={`${node.manager_name} (${node.manager_id})`}>
              <User size={12} className="flex-shrink-0" />
              {node.manager_name}
            </span>
          )}

          {(node.level === 'L3' || node.level === 'L4') && node.related_team && node.related_team.length > 0 && (
            <div className="flex items-center gap-1 max-w-[140px] overflow-hidden">
              {node.related_team.slice(0, 2).map((team, i) => (
                <span key={i} className="px-1.5 py-0.5 text-[10px] bg-secondary/15 text-secondary-light rounded whitespace-nowrap">{team}</span>
              ))}
              {node.related_team.length > 2 && <span className="text-[10px] text-gray-500">+{node.related_team.length - 2}</span>}
            </div>
          )}

          {node.keywords && node.keywords.length > 0 && (
            <div className="flex items-center gap-1 max-w-[140px] overflow-hidden">
              <Tag size={12} className="flex-shrink-0 text-gray-500" />
              {node.keywords.slice(0, 2).map((k, i) => (
                <span key={i} className="px-1.5 py-0.5 text-[10px] bg-primary/15 text-primary-light rounded whitespace-nowrap">{k}</span>
              ))}
              {node.keywords.length > 2 && <span className="text-[10px] text-gray-500">+{node.keywords.length - 2}</span>}
            </div>
          )}

          {hasChildren && (
            <span className="text-[10px] text-gray-500 w-10 text-right">{node.children.length}건</span>
          )}
        </div>

        {/* Action buttons */}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            {canEdit && NEXT_LEVEL[node.level] !== null && (
              <button
                onClick={() => openModal({ type: 'create', title: '하위 업무 추가', data: { parentId: node.id } })}
                className="p-1 text-gray-500 hover:text-green-400 hover:bg-green-400/10 rounded transition-colors"
                title="하위 추가"
              >
                <Plus size={13} />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => startEdit(node)}
                className="p-1 text-gray-500 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                title="수정"
              >
                <Pencil size={13} />
              </button>
            )}
            {canDelete && node.level !== 'Root' && (
              <button
                onClick={() => handleDelete(node)}
                className="p-1 text-gray-500 hover:text-danger hover:bg-danger/10 rounded transition-colors"
                title="삭제"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRow = (node: TreeNode): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isEditing = editingId === node.id;

    return (
      <div key={node.id}>
        {isEditing ? renderEditRow(node) : renderViewRow(node)}
        {hasChildren && isExpanded && !isEditing && (
          <div>{node.children.map((child) => renderRow(child))}</div>
        )}
        {/* Still show children if parent is being edited */}
        {hasChildren && isExpanded && isEditing && (
          <div>{node.children.map((child) => renderRow(child))}</div>
        )}
      </div>
    );
  };

  /* ── render ────────────────────────────────────── */

  return (
    <div className="h-full flex flex-col bg-base">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">업무 목록</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-surface border border-border rounded-lg hover:bg-surface/80 transition-colors flex items-center gap-1"
            >
              <ChevronsUpDown size={14} />
              전체 펼침
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-surface border border-border rounded-lg hover:bg-surface/80 transition-colors"
            >
              전체 접기
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="업무명, 조직, 담당자 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary focus:outline-none w-64"
          />
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          >
            <option value="">전체 조직</option>
            {organizations.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          >
            <option value="">AI 전체</option>
            <option value="true">AI 활용</option>
            <option value="false">AI 미활용</option>
          </select>
          <span className="text-sm text-gray-400 ml-auto">{totalVisible}건</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>
        ) : filteredTree.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">표시할 데이터가 없습니다</div>
        ) : (
          <div className="pb-8">{filteredTree.map((node) => renderRow(node))}</div>
        )}
      </div>
    </div>
  );
};
