import { useState, useMemo } from 'react';
import { Filter, RefreshCw, Sparkles, Maximize2, Minimize2, Focus, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useTaskStore } from '../../stores/taskStore';
import { Button } from '../shared/Button';

export const FilterBar = () => {
  const { tasks, filters, setFilters, expandAll, collapseAll, focusedL1Id, setFocusedL1 } = useTaskStore();
  const [showFilters, setShowFilters] = useState(false);

  // Get unique organizations from tasks
  const organizations = useMemo(() => {
    const orgs = new Set<string>();
    tasks.forEach(t => {
      if (t.organization) orgs.add(t.organization);
    });
    return Array.from(orgs).sort();
  }, [tasks]);

  // [IMP-02] L1 노드 목록
  const l1Tasks = useMemo(() => {
    return tasks.filter(t => t.level === 'L1').sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const focusedL1Name = useMemo(() => {
    if (!focusedL1Id) return null;
    return tasks.find(t => t.id === focusedL1Id)?.name || null;
  }, [tasks, focusedL1Id]);

  const levels = ['L1', 'L2', 'L3', 'L4'];

  const activeFilterCount = [
    filters.organization,
    filters.level,
    filters.isAiUtilized !== null ? 'ai' : null,
    filters.searchQuery,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilters({
      organization: null,
      level: null,
      isAiUtilized: null,
      searchQuery: null,
    });
  };

  return (
    <div className="bg-card border-b border-border">
      {/* Main Bar */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">업무 그래프</h2>
          <span className="px-2 py-0.5 bg-[#2A2A35] text-gray-400 text-sm rounded-full">
            {tasks.length} 노드
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* [IMP-02] L1 포커스 드롭다운 */}
          <div className="flex items-center gap-1">
            <select
              value={focusedL1Id || ''}
              onChange={(e) => setFocusedL1(e.target.value || null)}
              className="px-3 py-1.5 bg-[#1E1E2A] border border-border text-gray-300 rounded-lg text-sm focus:outline-none focus:ring-0 focus:border-white focus:border-2 min-w-[140px]"
            >
              <option value="">전체 L1 보기</option>
              {l1Tasks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Expand/Collapse Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Maximize2}
              onClick={expandAll}
              title="전체 펼치기"
            >
              전체 펼치기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Minimize2}
              onClick={collapseAll}
              title="전체 접기"
            >
              전체 접기
            </Button>
          </div>

          {/* Filter Toggle */}
          <Button
            variant={activeFilterCount > 0 ? 'primary' : 'secondary'}
            size="sm"
            icon={Filter}
            onClick={() => setShowFilters(!showFilters)}
          >
            필터
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* [IMP-02] L1 포커스 배너 */}
      {focusedL1Id && focusedL1Name && (
        <div className="px-6 py-2 bg-[#7952B3]/10 border-t border-[#7952B3]/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#7952B3]">
            <Focus size={14} />
            <span className="font-medium">📌 {focusedL1Name} 하위 업무 보기</span>
          </div>
          <button
            onClick={() => setFocusedL1(null)}
            className="text-xs text-[#7952B3] hover:text-[#5a3d8a] font-medium px-2 py-1 rounded hover:bg-[#7952B3]/10 transition-colors"
          >
            전체 보기
          </button>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-4 border-t border-border bg-[#1E1E2A]">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">검색</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={filters.searchQuery || ''}
                  onChange={(e) => setFilters({ searchQuery: e.target.value || null })}
                  placeholder="업무명, 조직, 담당자..."
                  className="pl-8 pr-3 py-2 bg-[#1E1E2A] border border-border text-gray-300 rounded-lg text-sm focus:outline-none focus:ring-0 focus:border-white focus:border-2 min-w-[200px] placeholder-gray-600"
                />
              </div>
            </div>

            {/* Organization Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">조직</label>
              <select
                value={filters.organization || ''}
                onChange={(e) => setFilters({ organization: e.target.value || null })}
                className="px-3 py-2 bg-[#1E1E2A] border border-border text-gray-300 rounded-lg text-sm focus:outline-none focus:ring-0 focus:border-white focus:border-2 min-w-[160px]"
              >
                <option value="">전체</option>
                {organizations.map(org => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
            </div>

            {/* Level Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">레벨</label>
              <select
                value={filters.level || ''}
                onChange={(e) => setFilters({ level: e.target.value || null })}
                className="px-3 py-2 bg-[#1E1E2A] border border-border text-gray-300 rounded-lg text-sm focus:outline-none focus:ring-0 focus:border-white focus:border-2 min-w-[100px]"
              >
                <option value="">전체</option>
                {levels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            {/* AI Utilized Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">AI 활용</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters({ isAiUtilized: filters.isAiUtilized === true ? null : true })}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors border',
                    filters.isAiUtilized === true
                      ? 'bg-purple-900/30 text-purple-400 border-purple-700'
                      : 'bg-[#1E1E2A] border-border text-gray-400 hover:bg-[#2A2A35]'
                  )}
                >
                  <Sparkles size={14} />
                  AI 활용
                </button>
                <button
                  onClick={() => setFilters({ isAiUtilized: filters.isAiUtilized === false ? null : false })}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
                    filters.isAiUtilized === false
                      ? 'bg-[#2A2A35] text-gray-200 border-gray-600'
                      : 'bg-[#1E1E2A] border-border text-gray-400 hover:bg-[#2A2A35]'
                  )}
                >
                  일반
                </button>
              </div>
            </div>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                <RefreshCw size={14} />
                초기화
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
