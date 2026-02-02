import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network,
  Sparkles,
  Building,
  TrendingUp,
  ArrowRight,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/shared/Button';
import { Badge } from '../components/shared/Badge';
import { useTaskStore } from '../stores/taskStore';
import { useAuthStore } from '../stores/authStore';
import { clsx } from 'clsx';

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

    const aiUtilized = tasks.filter(t => t.is_ai_utilized).length;
    const organizations = [...new Set(tasks.map(t => t.organization))];
    const total = tasks.length;

    return {
      total,
      byLevel,
      aiUtilized,
      aiPercentage: total > 0 ? ((aiUtilized / total) * 100).toFixed(1) : '0',
      organizations: organizations.length,
    };
  }, [tasks]);

  const recentTasks = tasks.slice(0, 5);

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

      <div className="flex-1 overflow-y-auto p-6">
        {/* Welcome Banner */}
        <div className="bg-[#5E3D8F] rounded-2xl p-6 mb-6 text-white">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Network}
            label="전체 노드"
            value={stats.total.toLocaleString()}
            color="bg-[#5E3D8F]"
          />
          <StatCard
            icon={Sparkles}
            label="AI 활용"
            value={`${stats.aiPercentage}%`}
            subValue={`${stats.aiUtilized} 건`}
            color="bg-[#5E3D8F]"
          />
          <StatCard
            icon={Building}
            label="조직 단위"
            value={stats.organizations.toString()}
            color="bg-[#5E3D8F]"
          />
          <StatCard
            icon={BarChart3}
            label="L4 업무"
            value={(stats.byLevel['L4'] || 0).toLocaleString()}
            color="bg-[#5E3D8F]"
          />
        </div>

        {/* Level Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart size={20} className="text-[#5E3D8F]" />
              레벨별 분포
            </h3>
            <div className="space-y-3">
              {['Root', 'L1', 'L2', 'L3', 'L4'].map((level) => {
                const count = stats.byLevel[level] || 0;
                const percentage = ((count / stats.total) * 100).toFixed(1);
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="w-12 text-sm font-medium text-gray-600">{level}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-[#5E3D8F]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-16 text-sm text-gray-500 text-right">
                      {count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-[#5E3D8F]" />
              빠른 액션
            </h3>
            <div className="space-y-3">
              <QuickActionButton
                label="업무 그래프 보기"
                description="전체 업무 구조를 시각화합니다"
                onClick={() => navigate('/graph')}
              />
              <QuickActionButton
                label="AI 활용 업무 필터"
                description="AI가 활용된 업무만 조회합니다"
                onClick={() => navigate('/graph')}
              />
              <QuickActionButton
                label="변경 이력 조회"
                description="최근 변경된 업무를 확인합니다"
                onClick={() => navigate('/history')}
              />
            </div>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">최근 업무</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
              전체 보기
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">레벨</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">업무명</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">조직</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">담당자</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">AI</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Badge variant="primary">{task.level}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 font-medium">{task.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{task.organization}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{task.manager_name || '-'}</td>
                    <td className="py-3 px-4">
                      {task.is_ai_utilized && (
                        <Badge variant="ai">
                          <Sparkles size={12} className="mr-1" />
                          AI
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
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
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
    <div className="flex items-center gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
      </div>
    </div>
  </div>
);

const QuickActionButton = ({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
  >
    <div>
      <p className="font-medium text-gray-900">{label}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <ArrowRight size={20} className="text-gray-400" />
  </button>
);
