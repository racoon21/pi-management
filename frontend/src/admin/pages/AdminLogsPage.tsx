import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ClipboardList, RefreshCw, UserPlus } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import {
  adminApi,
  type AdminActivityFeed,
  type AdminActivityLogItem,
  type AdminActivitySource,
} from '../../api/adminApi';

const SOURCE_FILTERS: { key: AdminActivitySource; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'task_history', label: '업무 변경' },
  { key: 'user_signup', label: '계정 등록' },
];

const SOURCE_BADGE_VARIANT = {
  task_history: 'primary' as const,
  user_signup: 'warning' as const,
};

const ACTION_BADGE_VARIANT = {
  TASK_CREATE: 'success' as const,
  TASK_UPDATE: 'primary' as const,
  TASK_DELETE: 'danger' as const,
  USER_REGISTERED: 'warning' as const,
};

const numberFormatter = new Intl.NumberFormat('ko-KR');

const formatCount = (value: number) => numberFormatter.format(value);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const AdminLogsPage = () => {
  const [source, setSource] = useState<AdminActivitySource>('all');
  const [feed, setFeed] = useState<AdminActivityFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getActivityFeed({ source, limit: 20 });
      setFeed(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '활동 로그 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const activityCountLabel = useMemo(
    () => formatCount(feed?.activities.length ?? 0),
    [feed]
  );

  if (loading && !feed) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="활동 로그" subtitle="활동 로그 원천 데이터를 불러오는 중입니다." />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          데이터를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="활동 로그" subtitle="업무 변경과 계정 등록 이벤트 원천을 한 화면에서 확인합니다." />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="bg-[#191927] rounded-2xl p-6 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                <Activity size={14} />
                Activity Source Foundation
              </div>
              <h2 className="mt-4 text-2xl font-bold">Admin 활동 로그의 데이터 원천을 먼저 연결한 단계입니다.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                현재는 기존에 이미 남고 있는 업무 변경 이력과 계정 등록 시점을 묶어서 통합 activity feed로 제공하고 있습니다.
                이후 브랜치에서 고도화 필터, 관리자 감사 로그 저장, 상세 조회 UI를 확장할 예정입니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                variant="ghost"
                icon={RefreshCw}
                onClick={fetchFeed}
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
              <Button size="sm" variant="danger" onClick={fetchFeed}>
                다시 시도
              </Button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SourceCard
            icon={Activity}
            label="전체 활동"
            value={formatCount(feed?.source_counts.total ?? 0)}
            tone="bg-[#5E3D8F]"
          />
          <SourceCard
            icon={ClipboardList}
            label="업무 변경 이력"
            value={formatCount(feed?.source_counts.task_history ?? 0)}
            tone="bg-[#7952B3]"
          />
          <SourceCard
            icon={UserPlus}
            label="계정 등록 이벤트"
            value={formatCount(feed?.source_counts.user_signup ?? 0)}
            tone="bg-[#F5B700]"
          />
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">원천 필터</h3>
              <p className="mt-1 text-sm text-gray-500">
                현재 화면에 표시된 활동 {activityCountLabel}건을 원천별로 나눠서 볼 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SOURCE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSource(filter.key)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    source === filter.key
                      ? 'bg-[#7952B3] text-white border-[#7952B3]'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">최근 활동 피드</h3>
            <p className="mt-1 text-sm text-gray-500">
              최신순으로 최대 20건까지 보여줍니다. 향후 브랜치에서 상세 검색, 고급 필터, 관리자 감사 로그 저장이 추가됩니다.
            </p>
          </div>

          {feed?.activities.length ? (
            <div className="space-y-3">
              {feed.activities.map((item) => (
                <ActivityCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">
              표시할 활동 로그가 없습니다.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const SourceCard = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

const ActivityCard = ({ item }: { item: AdminActivityLogItem }) => {
  const actorLabel = item.actor_name
    ? `${item.actor_name}${item.actor_employee_id ? ` (${item.actor_employee_id})` : ''}`
    : '시스템';
  const version = typeof item.metadata.version === 'number' ? `v${item.metadata.version}` : '-';
  const targetLabel = item.subject_secondary
    ? `${item.subject_label} · ${item.subject_secondary}`
    : item.subject_label;

  return (
    <article className="rounded-xl border border-gray-200 p-4 hover:border-[#7952B3]/40 hover:bg-[#7952B3]/[0.02] transition-colors">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SOURCE_BADGE_VARIANT[item.source]} size="sm">
              {item.source_label}
            </Badge>
            <Badge variant={ACTION_BADGE_VARIANT[item.action]} size="sm">
              {item.action_label}
            </Badge>
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-900">{item.description}</p>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(item.occurred_at)}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-gray-500 md:grid-cols-2 xl:grid-cols-4">
        <MetaItem label="수행자" value={actorLabel} />
        <MetaItem label="대상" value={targetLabel} />
        <MetaItem label="조직" value={item.organization ?? '-'} />
        <MetaItem label="세부" value={version} />
      </div>
    </article>
  );
};

const MetaItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-gray-50 px-3 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    <p className="mt-1 text-sm text-gray-700 break-words">{value}</p>
  </div>
);
