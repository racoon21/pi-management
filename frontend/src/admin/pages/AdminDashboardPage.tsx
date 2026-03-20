import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import {
  ArrowRight,
  Building2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { adminApi, type AdminDashboardSummary } from '../../api/adminApi';

const ROLE_META = {
  admin: { label: '관리자', barClass: 'bg-[#5E3D8F]', badgeVariant: 'primary' as const },
  editor: { label: '편집자', barClass: 'bg-[#7952B3]', badgeVariant: 'primary' as const },
  viewer: { label: '조회자', barClass: 'bg-[#9F85D1]', badgeVariant: 'default' as const },
  pending: { label: '승인 대기', barClass: 'bg-[#F5B700]', badgeVariant: 'warning' as const },
};

const numberFormatter = new Intl.NumberFormat('ko-KR');

const formatCount = (value: number) => numberFormatter.format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const roleEntries = (summary: AdminDashboardSummary | null) => [
  { key: 'admin', count: summary?.role_counts.admin ?? 0 },
  { key: 'editor', count: summary?.role_counts.editor ?? 0 },
  { key: 'viewer', count: summary?.role_counts.viewer ?? 0 },
  { key: 'pending', count: summary?.role_counts.pending ?? 0 },
] as const;

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getDashboardSummary();
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '관리자 대시보드 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const roleStats = useMemo(() => roleEntries(summary), [summary]);
  const roleMax = useMemo(() => Math.max(...roleStats.map((item) => item.count), 1), [roleStats]);
  const orgMax = useMemo(
    () => Math.max(...(summary?.organization_counts.map((item) => item.user_count) ?? [1]), 1),
    [summary]
  );

  if (loading && !summary) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="관리자 홈" subtitle="운영 지표를 불러오는 중입니다." />
        <div className="flex-1 flex items-center justify-center text-gray-500">데이터를 불러오는 중입니다...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="관리자 홈" subtitle="사용자와 승인 현황을 한눈에 확인합니다." />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="bg-[#5E3D8F] rounded-2xl p-6 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <ShieldCheck size={14} />
                Admin Dashboard
              </div>
              <h2 className="mt-4 text-2xl font-bold">운영 상태를 빠르게 확인하는 관리자 대시보드</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
                현재는 사용자 운영 지표를 우선 연결했습니다. 승인 대기 계정, 역할 분포, 최근 가입 현황을
                같은 화면에서 확인하고 필요한 페이지로 바로 이동할 수 있습니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="warning" size="md">승인 대기 {formatCount(summary?.pending_users ?? 0)}명</Badge>
                <Badge variant="success" size="md">활성 사용자 {formatCount(summary?.active_users ?? 0)}명</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                variant="secondary"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => navigate('/admin/users')}
                className="!bg-white !text-[#5E3D8F]"
              >
                사용자 관리
              </Button>
              <Button
                variant="ghost"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => navigate('/admin/requests')}
                className="!border !border-white/20 !bg-white/10 !text-white hover:!bg-white/20"
              >
                운영 요청 확인
              </Button>
              <Button
                variant="ghost"
                icon={RefreshCw}
                onClick={fetchSummary}
                loading={loading}
                className="!border !border-white/20 !bg-white/10 !text-white hover:!bg-white/20"
              >
                새로고침
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button size="sm" variant="danger" onClick={fetchSummary}>
                다시 시도
              </Button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Users} label="전체 사용자" value={formatCount(summary?.total_users ?? 0)} color="bg-[#5E3D8F]" />
          <StatCard icon={UserCheck} label="활성 사용자" value={formatCount(summary?.active_users ?? 0)} color="bg-green-600" />
          <StatCard icon={UserX} label="비활성 사용자" value={formatCount(summary?.inactive_users ?? 0)} color="bg-gray-700" />
          <StatCard icon={Clock3} label="승인 대기" value={formatCount(summary?.pending_users ?? 0)} color="bg-amber-500" />
          <StatCard icon={UserPlus} label="최근 7일 가입" value={formatCount(summary?.recent_signups_7d ?? 0)} color="bg-[#7952B3]" />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">역할 분포</h3>
                <p className="mt-1 text-sm text-gray-500">admin / editor / viewer / pending 비율을 확인합니다.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
                사용자 목록
              </Button>
            </div>

            <div className="space-y-4">
              {roleStats.map(({ key, count }) => {
                const meta = ROLE_META[key];
                const width = `${Math.max((count / roleMax) * 100, count > 0 ? 8 : 0)}%`;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                      </div>
                      <span className="font-medium text-gray-700">{formatCount(count)}명</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${meta.barClass}`} style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">조직별 사용자 수</h3>
                <p className="mt-1 text-sm text-gray-500">사용자 수가 많은 상위 5개 조직입니다.</p>
              </div>
              <Building2 className="text-[#5E3D8F]" size={20} />
            </div>

            {summary?.organization_counts.length ? (
              <div className="space-y-4">
                {summary.organization_counts.map((item) => (
                  <div key={item.organization} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-gray-800 truncate">{item.organization}</span>
                      <span className="text-gray-500">{formatCount(item.user_count)}명</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#8E72EE] transition-all duration-500"
                        style={{ width: `${Math.max((item.user_count / orgMax) * 100, 8)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-400">표시할 조직 데이터가 없습니다.</div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">최근 가입 사용자</h3>
              <p className="mt-1 text-sm text-gray-500">가장 최근에 생성된 계정을 확인합니다.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
              전체 보기
            </Button>
          </div>

          {summary?.recent_signups.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">사번</th>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">조직</th>
                    <th className="px-4 py-3">역할</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">가입일</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent_signups.map((user) => {
                    const roleKey = user.role === 'none' ? 'pending' : user.role;
                    const roleMeta = ROLE_META[roleKey as keyof typeof ROLE_META];
                    return (
                      <tr key={user.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/80">
                        <td className="px-4 py-3 font-mono text-gray-700">{user.employee_id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                        <td className="px-4 py-3 text-gray-600">{user.organization}</td>
                        <td className="px-4 py-3">
                          <Badge variant={roleMeta.badgeVariant}>{roleMeta.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={user.is_active ? 'success' : 'danger'}>
                            {user.is_active ? '활성' : '비활성'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(user.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">최근 가입 사용자 데이터가 없습니다.</div>
          )}
        </section>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: ElementType;
  label: string;
  value: string;
  color: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);
