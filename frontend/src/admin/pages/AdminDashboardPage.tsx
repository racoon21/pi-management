import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { adminApi, type AdminActivityLogItem, type AdminDashboardSummary } from '../../api/adminApi';

const ROLE_META = {
  admin: {
    label: '관리자',
    color: '#B8A1FF',
    dotClass: 'bg-[#B8A1FF]',
    barClass: 'bg-[#B8A1FF]',
    chipClass: 'border border-[#DDCFFF] bg-[#F4EEFF] text-[#6B4FCF]',
    badgeVariant: 'primary' as const,
  },
  editor: {
    label: '편집자',
    color: '#FFB7C8',
    dotClass: 'bg-[#FFB7C8]',
    barClass: 'bg-[#FFB7C8]',
    chipClass: 'border border-[#FFD6E0] bg-[#FFF1F5] text-[#C55B7A]',
    badgeVariant: 'primary' as const,
  },
  viewer: {
    label: '조회자',
    color: '#9ED8FF',
    dotClass: 'bg-[#9ED8FF]',
    barClass: 'bg-[#9ED8FF]',
    chipClass: 'border border-[#CDEBFF] bg-[#EEF8FF] text-[#3779A8]',
    badgeVariant: 'default' as const,
  },
  pending: {
    label: '승인 대기',
    color: '#FFD88A',
    dotClass: 'bg-[#FFD88A]',
    barClass: 'bg-[#FFD88A]',
    chipClass: 'border border-[#FFE7B5] bg-[#FFF8E8] text-[#B67A17]',
    badgeVariant: 'warning' as const,
  },
} satisfies Record<string, {
  label: string;
  color: string;
  dotClass: string;
  barClass: string;
  chipClass: string;
  badgeVariant: 'primary' | 'default' | 'warning';
}>;

const numberFormatter = new Intl.NumberFormat('ko-KR');

const formatCount = (value: number) => numberFormatter.format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const roleEntries = (summary: AdminDashboardSummary | null) => [
  { key: 'admin', count: summary?.role_counts.admin ?? 0 },
  { key: 'editor', count: summary?.role_counts.editor ?? 0 },
  { key: 'viewer', count: summary?.role_counts.viewer ?? 0 },
  { key: 'pending', count: summary?.role_counts.pending ?? 0 },
] as const;

const getActivityBadgeVariant = (activity: AdminActivityLogItem) => {
  if (activity.source === 'user_signup') return 'warning' as const;
  if (activity.action === 'TASK_DELETE') return 'danger' as const;
  if (activity.action === 'TASK_UPDATE') return 'primary' as const;
  return 'success' as const;
};

const getRoleBadgeVariant = (role: string) => {
  if (role === 'none') return ROLE_META.pending.badgeVariant;
  if (role === 'admin' || role === 'editor' || role === 'viewer') {
    return ROLE_META[role].badgeVariant;
  }
  return 'default' as const;
};

const getRoleLabel = (role: string) => {
  if (role === 'none') return ROLE_META.pending.label;
  if (role === 'admin' || role === 'editor' || role === 'viewer') {
    return ROLE_META[role].label;
  }
  return role;
};

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [activities, setActivities] = useState<AdminActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setSummaryError(null);
    setActivityError(null);

    const [summaryResult, activityResult] = await Promise.allSettled([
      adminApi.getDashboardSummary(),
      adminApi.getActivityFeed({ limit: 6 }),
    ]);

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
    } else {
      setSummaryError(
        summaryResult.reason instanceof Error
          ? summaryResult.reason.message
          : '관리자 대시보드 요약 정보를 불러오지 못했습니다.'
      );
    }

    if (activityResult.status === 'fulfilled') {
      setActivities(activityResult.value.activities);
    } else {
      setActivityError(
        activityResult.reason instanceof Error
          ? activityResult.reason.message
          : '최근 활동 위젯을 불러오지 못했습니다.'
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const roleStats = useMemo(() => roleEntries(summary), [summary]);
  const roleTotal = useMemo(() => roleStats.reduce((sum, item) => sum + item.count, 0), [roleStats]);
  const roleMax = useMemo(() => Math.max(...roleStats.map((item) => item.count), 1), [roleStats]);
  const roleGradient = useMemo(() => {
    if (!roleTotal) return 'conic-gradient(#E5E7EB 0% 100%)';

    let cursor = 0;
    const segments = roleStats
      .filter((item) => item.count > 0)
      .map((item) => {
        const next = cursor + (item.count / roleTotal) * 100;
        const segment = `${ROLE_META[item.key].color} ${cursor}% ${next}%`;
        cursor = next;
        return segment;
      });

    return `conic-gradient(${segments.join(', ')})`;
  }, [roleStats, roleTotal]);

  const topOrganization = summary?.organization_counts[0] ?? null;
  const latestSignup = summary?.recent_signups[0] ?? null;
  const latestActivity = activities[0] ?? null;
  const activationRate = summary?.total_users
    ? Math.round((summary.active_users / summary.total_users) * 100)
    : 0;
  const pendingRate = summary?.total_users
    ? Math.round((summary.pending_users / summary.total_users) * 100)
    : 0;

  if (loading && !summary) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F7F7FB]">
        <Header
          title="관리자 홈"
          subtitle="운영 지표와 승인 현황을 불러오는 중입니다."
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <DashboardHeroSkeleton />
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </section>
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <PanelSkeleton className="min-h-[320px]" />
            <PanelSkeleton className="min-h-[320px]" />
          </section>
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <PanelSkeleton className="min-h-[360px]" />
            <PanelSkeleton className="min-h-[360px]" />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F7F7FB]">
      <Header
        title="관리자 홈"
        subtitle="사용자 승인, 역할 분포, 최근 활동을 한 화면에서 관리합니다."
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="relative overflow-hidden rounded-[28px] bg-[#161625] p-6 text-white shadow-[0_24px_64px_rgba(22,22,37,0.22)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(142,114,238,0.36),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(245,183,0,0.18),_transparent_30%)]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <ShieldCheck size={14} />
                Admin Dashboard
              </div>
              <h2 className="mt-4 text-2xl font-bold leading-tight xl:text-[30px]">
                오늘 운영 상태를 한 눈에 읽는 관리자 대시보드입니다.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 xl:text-[15px]">
                승인 대기 사용자, 활성화 상태, 조직별 분포, 최근 활동을 요약해 보여줍니다. 운영이 필요한 화면으로 바로
                이동할 수 있도록 큐와 후속 액션도 함께 정리했습니다.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                <HeroMetric
                  label="전체 사용자"
                  value={`${formatCount(summary?.total_users ?? 0)}명`}
                  hint={`활성 ${formatCount(summary?.active_users ?? 0)}명 / 비활성 ${formatCount(summary?.inactive_users ?? 0)}명`}
                />
                <HeroMetric
                  label="승인 대기 큐"
                  value={`${formatCount(summary?.pending_users ?? 0)}명`}
                  hint={summary?.pending_users ? '사용자 관리에서 우선 처리가 필요합니다.' : '현재 대기 계정이 없습니다.'}
                />
                <HeroMetric
                  label="최근 활동"
                  value={latestActivity ? latestActivity.action_label : '-'}
                  hint={latestActivity ? `${latestActivity.description} / ${formatDateTime(latestActivity.occurred_at)}` : '표시할 활동이 없습니다.'}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <Button
                variant="secondary"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => navigate('/admin/users')}
                className="!border-0 !bg-white !text-[#5E3D8F] hover:!bg-white/90"
              >
                사용자 관리
              </Button>
              <Button
                variant="ghost"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => navigate('/admin/logs')}
                className="!border !border-white/15 !bg-white/10 !text-white hover:!bg-white/20"
              >
                활동 로그 보기
              </Button>
              <Button
                variant="ghost"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => navigate('/admin/requests')}
                className="!border !border-white/15 !bg-white/10 !text-white hover:!bg-white/20"
              >
                운영 요청 확인
              </Button>
              <Button
                variant="ghost"
                icon={RefreshCw}
                loading={refreshing}
                onClick={() => fetchDashboard('refresh')}
                className="!border !border-white/15 !bg-white/10 !text-white hover:!bg-white/20"
              >
                새로고침
              </Button>
            </div>
          </div>
        </section>

        {summaryError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <TriangleAlert size={16} />
                <span>{summaryError}</span>
              </div>
              <Button size="sm" variant="danger" onClick={() => fetchDashboard('refresh')}>
                다시 시도
              </Button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={Users}
            label="전체 사용자"
            value={`${formatCount(summary?.total_users ?? 0)}명`}
            helper="운영 포털에 등록된 전\ccb4 계정 수"
            color="bg-[#5E3D8F]"
          />
          <StatCard
            icon={UserCheck}
            label="활성 사용자"
            value={`${formatCount(summary?.active_users ?? 0)}명`}
            helper={`활성화 비율 ${activationRate}%`}
            color="bg-emerald-600"
          />
          <StatCard
            icon={UserX}
            label="비활성 사용자"
            value={`${formatCount(summary?.inactive_users ?? 0)}명`}
            helper="로그인이 차단된 계정"
            color="bg-slate-700"
          />
          <StatCard
            icon={Clock3}
            label="승인 대기"
            value={`${formatCount(summary?.pending_users ?? 0)}명`}
            helper={`전체 대비 ${pendingRate}%`}
            color="bg-amber-500"
          />
          <StatCard
            icon={UserPlus}
            label="최근 7일 가입"
            value={`${formatCount(summary?.recent_signups_7d ?? 0)}명`}
            helper={latestSignup ? `${latestSignup.name} / ${formatDate(latestSignup.created_at)}` : '신규 가입 없음'}
            color="bg-[#7A5AC7]"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F3EEFF] px-3 py-1 text-xs font-semibold text-[#5E3D8F]">
                  <BarChart3 size={14} />
                  역할 분포
                </div>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">권한 구성이 어떻게 나뉘어 있는지 보여줍니다.</h3>
                <p className="mt-1 text-sm text-gray-500">admin / editor / viewer / pending 비중을 도넛형 시각화와 리스트로 함께 제공합니다.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
                사용자 목록
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
              <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full bg-gray-100 p-5">
                <div
                  className="relative flex h-full w-full items-center justify-center rounded-full"
                  style={{ background: roleGradient }}
                >
                  <div className="flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">계정</span>
                    <strong className="mt-2 text-3xl font-bold text-gray-900">{formatCount(roleTotal)}</strong>
                    <span className="mt-1 text-xs text-gray-500">전체 사용자</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {roleStats.map(({ key, count }) => {
                  const meta = ROLE_META[key];
                  const width = `${Math.max((count / roleMax) * 100, count > 0 ? 10 : 0)}%`;
                  const ratio = roleTotal ? Math.round((count / roleTotal) * 100) : 0;
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                          <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                          <span className="font-medium">{meta.label}</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chipClass}`}>
                            {ratio}%
                          </span>
                        </div>
                        <span className="font-semibold text-gray-900">{formatCount(count)}명</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full rounded-full transition-all duration-500 ${meta.barClass}`} style={{ width }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF7E8] px-3 py-1 text-xs font-semibold text-[#D97706]">
                  <Sparkles size={14} />
                  운영 인사이트
                </div>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">오늘 우선적으로 봐야 할 운영 포인트입니다.</h3>
                <p className="mt-1 text-sm text-gray-500">승인 대기, 조직 집중도, 최근 가입 흐름을 간단한 코멘트로 요약했습니다.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <InsightRow
                title="승인 대기 큐"
                value={`${formatCount(summary?.pending_users ?? 0)}명`}
                description={summary?.pending_users
                  ? '신규 계정 승인이 미루어지지 않도록 우선 확인을 권장합니다.'
                  : '대기 계정이 없어 운영 상태가 안정적입니다.'}
                tone="amber"
              />
              <InsightRow
                title="사용자 집중 조직"
                value={topOrganization ? topOrganization.organization : '데이터 없음'}
                description={topOrganization
                  ? `${formatCount(topOrganization.user_count)}명이 속한 최대 관리 대상 조직입니다.`
                  : '조직 집계 데이터가 아직 없습니다.'}
                tone="violet"
              />
              <InsightRow
                title="최근 가입 흐름"
                value={`${formatCount(summary?.recent_signups_7d ?? 0)}명 / 7일`}
                description={latestSignup
                  ? `${latestSignup.name} 계정이 ${formatDate(latestSignup.created_at)}에 생성되었습니다.`
                  : '최근 가입 이력이 없습니다.'}
                tone="slate"
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">최근 가입 사용자</h3>
                <p className="mt-1 text-sm text-gray-500">가입한 사용자의 역할, 상태, 조직을 바로 확인할 수 있도록 구성했습니다.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
                전체 보기
              </Button>
            </div>

            {summary?.recent_signups.length ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      <th className="px-4 py-3">사번</th>
                      <th className="px-4 py-3">사용자</th>
                      <th className="px-4 py-3">조직</th>
                      <th className="px-4 py-3">역할</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3">가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_signups.map((user) => (
                      <tr key={user.id} className="border-b border-gray-50 last:border-b-0 hover:bg-[#F8F7FC]">
                        <td className="px-4 py-3 font-mono text-gray-700">{user.employee_id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="mt-1 text-xs text-gray-400">{user.id.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{user.organization}</td>
                        <td className="px-4 py-3">
                          <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.is_active ? 'success' : 'danger'}>
                            {user.is_active ? '활성' : '비활성'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(user.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyPanel
                title="최근 가입 사용자가 없습니다."
                description="가입 데이터가 쌓이면 여기에 자동으로 표시됩니다."
              />
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF6FF] px-3 py-1 text-xs font-semibold text-[#2563EB]">
                  <Activity size={14} />
                  최근 활동
                </div>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">지금 운영에 영향을 주는 최신 로그입니다.</h3>
                <p className="mt-1 text-sm text-gray-500">활동 로그의 최신 6건을 타임라인 형태로 요약해 보여줍니다.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/logs')}>
                전체 로그
              </Button>
            </div>

            {activityError ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <div className="flex items-start gap-2">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  <span>{activityError}</span>
                </div>
              </div>
            ) : activities.length ? (
              <div className="mt-5 space-y-4">
                {activities.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => navigate('/admin/logs', { state: { selectedActivityId: activity.id } })}
                    className="w-full rounded-2xl border border-gray-100 px-4 py-4 text-left transition-colors hover:border-[#D9CCF5] hover:bg-[#FAF7FF]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getActivityBadgeVariant(activity)}>{activity.action_label}</Badge>
                          <Badge variant="default">{activity.source_label}</Badge>
                          <span className="text-xs text-gray-400">{formatDateTime(activity.occurred_at)}</span>
                        </div>
                        <p className="text-sm font-medium leading-6 text-gray-900">{activity.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>수행자 {activity.actor_name ?? '-'}</span>
                          <span>대상 {activity.subject_label}</span>
                          <span>조직 {activity.organization ?? '-'}</span>
                        </div>
                      </div>
                      <ArrowRight size={16} className="mt-1 shrink-0 text-gray-300" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyPanel
                className="mt-5"
                title="표시할 최근 활동이 없습니다."
                description="활동 로그가 쌓이면 이 영역에 자동으로 요약 표시됩니다."
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const HeroMetric = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{label}</p>
    <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    <p className="mt-2 text-xs leading-5 text-white/70">{hint}</p>
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  helper,
  color,
}: {
  icon: ElementType;
  label: string;
  value: string;
  helper: string;
  color: string;
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        <p className="mt-2 text-sm leading-5 text-gray-500">{helper}</p>
      </div>
    </div>
  </div>
);

const InsightRow = ({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: 'amber' | 'violet' | 'slate';
}) => {
  const toneClass = {
    amber: 'bg-[#FFF8EB] border-[#FDE7B8] text-[#B45309]',
    violet: 'bg-[#F5F0FF] border-[#D9CCF5] text-[#6D28D9]',
    slate: 'bg-[#F8FAFC] border-[#E2E8F0] text-[#334155]',
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-lg font-bold">{value}</p>
      </div>
      <p className="mt-3 text-sm leading-6 opacity-90">{description}</p>
    </div>
  );
};

const EmptyPanel = ({
  title,
  description,
  className = '',
}: {
  title: string;
  description: string;
  className?: string;
}) => (
  <div className={`rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center ${className}`}>
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
      <Sparkles size={18} className="text-[#7A5AC7]" />
    </div>
    <p className="mt-4 text-sm font-semibold text-gray-700">{title}</p>
    <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
  </div>
);

const DashboardHeroSkeleton = () => (
  <section className="overflow-hidden rounded-[28px] bg-[#161625] p-6 shadow-[0_24px_64px_rgba(22,22,37,0.22)]">
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-40 rounded-full bg-white/10" />
      <div className="h-10 w-2/3 rounded-xl bg-white/10" />
      <div className="h-5 w-3/4 rounded-xl bg-white/10" />
      <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-white/10" />
        ))}
      </div>
    </div>
  </section>
);

const PanelSkeleton = ({ className = '' }: { className?: string }) => (
  <div className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-40 rounded-xl bg-gray-100" />
      <div className="h-4 w-64 rounded-xl bg-gray-100" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-14 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="animate-pulse flex items-start gap-4">
      <div className="h-12 w-12 rounded-2xl bg-gray-100" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-3 w-24 rounded-xl bg-gray-100" />
        <div className="h-7 w-20 rounded-xl bg-gray-100" />
        <div className="h-4 w-32 rounded-xl bg-gray-100" />
      </div>
    </div>
  </div>
);
