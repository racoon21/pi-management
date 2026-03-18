import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network,
  Sparkles,
  Building,
  ArrowRight,
  BarChart3,
  PieChart,
  Clock,
  Layers,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/shared/Button';
import { Badge } from '../components/shared/Badge';
import { useTaskStore } from '../stores/taskStore';
import { useAuthStore } from '../stores/authStore';
import { clsx } from 'clsx';

/* 레벨별 색상 (CLAUDE.md 정의 기준) */
const LEVEL_COLORS: Record<string, string> = {
  Root: '#8E72EE',
  L1: '#00D7D2',
  L2: '#191927',
  L3: '#7259D9',
  L4: '#E4E3EC',
};
const LEVEL_BAR_COLORS: Record<string, string> = {
  Root: 'bg-[#8E72EE]',
  L1: 'bg-[#00D7D2]',
  L2: 'bg-[#191927]',
  L3: 'bg-[#7259D9]',
  L4: 'bg-[#B8B3D0]',
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { tasks, fetchTasks, isLoading } = useTaskStore();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const stats = useMemo(() => {
    const byLevel = tasks.reduce((acc, task) => {
      acc[task.level] = (acc[task.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // AI 활용률: L4 기준
    const l4Tasks = tasks.filter((t) => t.level === 'L4');
    const l4AiCount = l4Tasks.filter((t) => t.is_ai_utilized).length;

    // 조직 단위: L2 기준
    const l2Orgs = [...new Set(tasks.filter((t) => t.level === 'L2').map((t) => t.name))];

    // Root 제외 전체 노드 수
    const totalExcludingRoot = tasks.filter((t) => t.level !== 'Root').length;

    return {
      total: totalExcludingRoot,
      byLevel,
      l4Total: l4Tasks.length,
      l4AiCount,
      l4AiPercentage: l4Tasks.length > 0 ? ((l4AiCount / l4Tasks.length) * 100).toFixed(1) : '0',
      l2Orgs,
      l2OrgCount: l2Orgs.length,
    };
  }, [tasks]);

  // 조직(L2)별 L4 업무 수 및 AI 활용 수
  const orgStats = useMemo(() => {
    const l2Tasks = tasks.filter((t) => t.level === 'L2');

    // 부모→자식 맵 구축
    const childrenMap = new Map<string, string[]>();
    for (const t of tasks) {
      if (t.parent_id) {
        const arr = childrenMap.get(t.parent_id) || [];
        arr.push(t.id);
        childrenMap.set(t.parent_id, arr);
      }
    }

    // BFS로 L2 하위의 모든 L4 수집
    return l2Tasks.map((l2) => {
      let l4Count = 0;
      let l4AiCount = 0;
      const queue = [l2.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        const children = childrenMap.get(id) || [];
        for (const cid of children) {
          const child = tasks.find((t) => t.id === cid);
          if (child) {
            if (child.level === 'L4') {
              l4Count++;
              if (child.is_ai_utilized) l4AiCount++;
            }
            queue.push(cid);
          }
        }
      }
      const aiPercent = l4Count > 0 ? Math.round((l4AiCount / l4Count) * 100) : 0;
      return { name: l2.name, l4Count, l4AiCount, aiPercent };
    }).sort((a, b) => b.l4Count - a.l4Count).slice(0, 8);
  }, [tasks]);

  const recentTasks = tasks.slice(0, 8);

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="대시보드" subtitle={`안녕하세요, ${user?.name}님`} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="대시보드" subtitle={`안녕하세요, ${user?.name}님`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Welcome Banner - 단색 배경, 그라데이션 없음 */}
        <div className="bg-[#5E3D8F] rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">전사 업무 프로세스 관리 시스템</h2>
          <p className="text-white/80 mb-4">
            SK브로드밴드의 모든 업무를 계층적으로 관리하고 추적하세요.
          </p>
          <Button
            variant="secondary"
            icon={ArrowRight}
            iconPosition="right"
            onClick={() => navigate('/graph')}
            className="!bg-white !text-[#5E3D8F]"
          >
            업무 그래프 보기
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Network}
            label="전체 노드"
            value={stats.total.toLocaleString()}
            color="bg-[#8E72EE]"
          />
          <StatCard
            icon={Sparkles}
            label="AI 활용률 (L4)"
            value={`${stats.l4AiPercentage}%`}
            subValue={`${stats.l4AiCount} / ${stats.l4Total} 건`}
            color="bg-[#7259D9]"
          />
          <StatCard
            icon={Building}
            label="조직 단위 (L2)"
            value={stats.l2OrgCount.toString()}
            color="bg-[#00D7D2]"
          />
          <StatCard
            icon={BarChart3}
            label="L4 업무"
            value={(stats.byLevel['L4'] || 0).toLocaleString()}
            color="bg-[#191927]"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Level Distribution - Root 제외 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Layers size={20} className="text-[#5E3D8F]" />
              레벨별 분포
            </h3>
            <div className="space-y-3">
              {['L1', 'L2', 'L3', 'L4'].map((level) => {
                const count = stats.byLevel[level] || 0;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span
                      className="w-12 text-sm font-semibold px-2 py-0.5 rounded text-center"
                      style={{
                        backgroundColor: LEVEL_COLORS[level] + '18',
                        color: level === 'L4' ? '#6B5B8D' : LEVEL_COLORS[level],
                      }}
                    >
                      {level}
                    </span>
                    <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all duration-700', LEVEL_BAR_COLORS[level])}
                        style={{ width: `${Math.max(percentage, 1)}%` }}
                      />
                    </div>
                    <span className="w-20 text-sm text-gray-600 text-right font-medium">
                      {count.toLocaleString()} <span className="text-gray-400 text-xs">({percentage.toFixed(1)}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Organization Stats (L2 기준) - 레벨별 분포와 동일 디자인 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart size={20} className="text-[#00D7D2]" />
              조직별 업무 현황 (L2)
            </h3>
            {orgStats.length === 0 ? (
              <div className="text-gray-400 text-sm text-center py-8">데이터 없음</div>
            ) : (
              <div className="space-y-3">
                {orgStats.map((org) => {
                  return (
                    <div key={org.name} className="flex items-center gap-3">
                      <span
                        className="w-28 text-sm font-semibold px-2 py-0.5 rounded truncate text-center"
                        style={{ backgroundColor: '#B8B3D0' + '30', color: '#6B5B8D' }}
                        title={org.name}
                      >
                        {org.name}
                      </span>
                      <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#B8B3D0] transition-all duration-700"
                          style={{ width: `${Math.max(org.aiPercent, 1)}%` }}
                        />
                      </div>
                      <span className="w-24 text-sm text-gray-600 text-right font-medium">
                        {org.l4Count.toLocaleString()} <span className="text-gray-400 text-xs">(AI {org.aiPercent}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-[#5E3D8F]" />
              최근 업무
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
              전체 보기
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">레벨</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">업무명</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">조직</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">담당자</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">AI</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task, idx) => (
                  <tr
                    key={task.id}
                    className={clsx(
                      'hover:bg-gray-50/80 transition-colors cursor-pointer',
                      idx < recentTasks.length - 1 && 'border-b border-gray-50'
                    )}
                    onClick={() => navigate('/graph')}
                  >
                    <td className="py-3 px-4">
                      <span
                        className="inline-block text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: LEVEL_COLORS[task.level] + '18',
                          color: task.level === 'L4' ? '#6B5B8D' : LEVEL_COLORS[task.level],
                        }}
                      >
                        {task.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 font-medium max-w-xs truncate">{task.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{task.organization}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{task.manager_name || '-'}</td>
                    <td className="py-3 px-4">
                      {task.is_ai_utilized && (
                        <Badge variant="ai">
                          <Sparkles size={10} className="mr-1" />
                          AI
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {recentTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                      등록된 업무가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subValue && <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>}
      </div>
    </div>
  </div>
);
