import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { Activity, ClipboardList, Filter, RefreshCw, Search, UserPlus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import {
  adminApi,
  type AdminActivityAction,
  type AdminActivityFeed,
  type AdminActivityLogItem,
  type AdminActivitySource,
} from '../../api/adminApi';

const SOURCE_FILTERS: { key: AdminActivitySource; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'task_history', label: '업무 변경' },
  { key: 'user_signup', label: '계정 등록' },
];

const ACTION_FILTERS: { key: AdminActivityAction; label: string }[] = [
  { key: 'all', label: '전체 이벤트' },
  { key: 'TASK_CREATE', label: '업무 생성' },
  { key: 'TASK_UPDATE', label: '업무 수정' },
  { key: 'TASK_DELETE', label: '업무 삭제' },
  { key: 'USER_REGISTERED', label: '계정 등록' },
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

const PAGE_SIZE = 10;
const MAX_ACTIVITY_ITEMS = 100;
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

const getSourceScopedTotal = (feed: AdminActivityFeed | null, source: AdminActivitySource) => {
  if (!feed) return 0;
  return {
    all: feed.source_counts.total,
    task_history: feed.source_counts.task_history,
    user_signup: feed.source_counts.user_signup,
  }[source];
};

const getActionCount = (
  feed: AdminActivityFeed | null,
  source: AdminActivitySource,
  action: AdminActivityAction
) => {
  if (!feed) return 0;
  if (action === 'all') return getSourceScopedTotal(feed, source);
  return {
    TASK_CREATE: feed.action_counts.task_create,
    TASK_UPDATE: feed.action_counts.task_update,
    TASK_DELETE: feed.action_counts.task_delete,
    USER_REGISTERED: feed.action_counts.user_registered,
  }[action];
};

export const AdminLogsPage = () => {
  const location = useLocation();
  const navigationState = location.state as { selectedActivityId?: string } | null;
  const pendingSelectedIdRef = useRef<string | null>(navigationState?.selectedActivityId ?? null);
  const [source, setSource] = useState<AdminActivitySource>('all');
  const [action, setAction] = useState<AdminActivityAction>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [feed, setFeed] = useState<AdminActivityFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getActivityFeed({
        source,
        action,
        query: deferredSearch,
        limit: MAX_ACTIVITY_ITEMS,
      });
      setFeed(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '활동 로그 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [action, deferredSearch, source]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    setCurrentPage(1);
  }, [source, action, deferredSearch]);

  useEffect(() => {
    pendingSelectedIdRef.current = navigationState?.selectedActivityId ?? null;
  }, [navigationState?.selectedActivityId]);

  const totalFetchedActivities = feed?.activities.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFetchedActivities / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedActivities = useMemo(() => {
    if (!feed?.activities.length) return [];
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return feed.activities.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, feed]);

  useEffect(() => {
    if (!feed?.activities.length || !pendingSelectedIdRef.current) return;

    const targetId = pendingSelectedIdRef.current;
    const targetIndex = feed.activities.findIndex((item) => item.id === targetId);

    if (targetIndex === -1) {
      pendingSelectedIdRef.current = null;
      return;
    }

    const targetPage = Math.floor(targetIndex / PAGE_SIZE) + 1;
    if (currentPage !== targetPage) {
      setCurrentPage(targetPage);
      return;
    }

    if (selectedId !== targetId) {
      setSelectedId(targetId);
      return;
    }

    pendingSelectedIdRef.current = null;
  }, [currentPage, feed, selectedId]);

  useEffect(() => {
    if (pendingSelectedIdRef.current) return;

    if (!paginatedActivities.length) {
      setSelectedId(null);
      return;
    }

    const selectedExists = paginatedActivities.some((item) => item.id === selectedId);
    if (!selectedExists) {
      setSelectedId(paginatedActivities[0].id);
    }
  }, [paginatedActivities, selectedId]);

  const selectedActivity = useMemo(
    () => paginatedActivities.find((item) => item.id === selectedId) ?? null,
    [paginatedActivities, selectedId]
  );

  const lastActivityLabel = feed?.activities[0]?.occurred_at
    ? formatDateTime(feed.activities[0].occurred_at)
    : '-';

  const pageStart = totalFetchedActivities ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = totalFetchedActivities ? Math.min(currentPage * PAGE_SIZE, totalFetchedActivities) : 0;

  if (loading && !feed) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="활동 로그" subtitle="활동 로그 화면을 불러오는 중입니다." />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          데이터를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="활동 로그" subtitle="검색, 이벤트 필터, 상세 패널로 최근 활동을 추적합니다." />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="bg-[#191927] rounded-2xl p-6 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                <Filter size={14} />
                Activity History UI
              </div>
              <h2 className="mt-4 text-2xl font-bold">관리자 활동 로그를 실제 조회 화면 형태로 고도화한 단계입니다.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
                이제 원천별 필터에 더해 이벤트 타입 필터와 검색을 함께 적용할 수 있고, 목록에서 선택한 항목의 세부 정보를
                오른쪽 패널에서 바로 확인할 수 있습니다.
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

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Activity} label="전체 활동 원천" value={formatCount(feed?.source_counts.total ?? 0)} tone="bg-[#5E3D8F]" />
          <StatCard icon={Filter} label="현재 조회 결과" value={formatCount(feed?.filtered_count ?? 0)} tone="bg-[#7952B3]" />
          <StatCard icon={ClipboardList} label="업무 변경 원천" value={formatCount(feed?.source_counts.task_history ?? 0)} tone="bg-[#4B6CB7]" />
          <StatCard icon={UserPlus} label="계정 등록 원천" value={formatCount(feed?.source_counts.user_signup ?? 0)} tone="bg-[#F5B700]" />
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">로그 필터</h3>
              <p className="mt-1 text-sm text-gray-500">
                원천, 이벤트 타입, 검색어를 조합해 최근 활동 이력을 빠르게 좁혀볼 수 있습니다.
              </p>
            </div>
            <div className="w-full xl:w-[360px]">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="업무명, 사용자명, 조직명으로 검색"
                icon={Search}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">원천</p>
              <div className="flex flex-wrap gap-2">
                {SOURCE_FILTERS.map((filter) => (
                  <FilterChip
                    key={filter.key}
                    active={source === filter.key}
                    label={filter.label}
                    onClick={() => setSource(filter.key)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">이벤트 타입</p>
              <div className="flex flex-wrap gap-2">
                {ACTION_FILTERS.map((filter) => (
                  <FilterChip
                    key={filter.key}
                    active={action === filter.key}
                    label={`${filter.label} (${formatCount(getActionCount(feed, source, filter.key))})`}
                    onClick={() => setAction(filter.key)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <Badge variant="default" size="md">현재 결과 {formatCount(feed?.filtered_count ?? 0)}건</Badge>
            <Badge variant="primary" size="md">최근 활동 {lastActivityLabel}</Badge>
            {totalFetchedActivities > 0 && (feed?.filtered_count ?? 0) > totalFetchedActivities && (
              <Badge variant="warning" size="md">최근 100건만 표시</Badge>
            )}
            {deferredSearch.trim() && <Badge variant="warning" size="md">검색어: {deferredSearch.trim()}</Badge>}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">활동 목록</h3>
              <p className="mt-1 text-sm text-gray-500">최신순 최근 100건을 10건씩 페이지로 표시합니다.</p>
            </div>

            {totalFetchedActivities ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[190px]" />
                      <col className="w-[96px]" />
                      <col className="w-[96px]" />
                      <col />
                      <col className="w-[124px]" />
                      <col className="w-[112px]" />
                    </colgroup>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">시간</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">원천</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">이벤트</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">대상</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">수행자</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">조직</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedActivities.map((item) => {
                        const actorLabel = item.actor_name
                          ? `${item.actor_name}${item.actor_employee_id ? ` (${item.actor_employee_id})` : ''}`
                          : '시스템';
                        const targetLabel = item.subject_secondary
                          ? `${item.subject_label} · ${item.subject_secondary}`
                          : item.subject_label;

                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`border-b border-gray-100 cursor-pointer transition-colors ${
                              selectedId === item.id ? 'bg-[#7952B3]/[0.08]' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(item.occurred_at)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge variant={SOURCE_BADGE_VARIANT[item.source]} size="sm">{item.source_label}</Badge>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge variant={ACTION_BADGE_VARIANT[item.action]} size="sm">{item.action_label}</Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-800"><div className="truncate" title={targetLabel}>{targetLabel}</div></td>
                            <td className="px-4 py-3 text-gray-600"><div className="truncate" title={actorLabel}>{actorLabel}</div></td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{item.organization ?? '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-500">
                    {formatCount(pageStart)}-{formatCount(pageEnd)} / {formatCount(totalFetchedActivities)}건 표시 · {currentPage}/{totalPages}페이지
                  </p>

                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <PageButton label="이전" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} />
                      {Array.from({ length: totalPages }, (_, index) => {
                        const page = index + 1;
                        return (
                          <PageButton
                            key={page}
                            label={String(page)}
                            active={page === currentPage}
                            onClick={() => setCurrentPage(page)}
                          />
                        );
                      })}
                      <PageButton
                        label="다음"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                현재 조건에 맞는 활동 로그가 없습니다.
              </div>
            )}
          </div>

          <aside className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">선택 상세</h3>
                <p className="mt-1 text-sm text-gray-500">목록에서 선택한 활동의 세부 정보를 확인합니다.</p>
              </div>
            </div>

            {selectedActivity ? (
              <DetailPanel item={selectedActivity} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                왼쪽 목록에서 활동을 선택하면 여기에서 상세 정보를 볼 수 있습니다.
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ElementType;
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

const FilterChip = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
      active
        ? 'bg-[#7952B3] text-white border-[#7952B3]'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
    }`}
  >
    {label}
  </button>
);

const PageButton = ({
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`min-w-9 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
      active
        ? 'border-[#7952B3] bg-[#7952B3] text-white'
        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
    }`}
  >
    {label}
  </button>
);

const DetailPanel = ({ item }: { item: AdminActivityLogItem }) => {
  const actorLabel = item.actor_name
    ? `${item.actor_name}${item.actor_employee_id ? ` (${item.actor_employee_id})` : ''}`
    : '시스템';
  const targetLabel = item.subject_secondary
    ? `${item.subject_label} · ${item.subject_secondary}`
    : item.subject_label;
  const metadataEntries = Object.entries(item.metadata).filter(([, value]) => value !== null && value !== '');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SOURCE_BADGE_VARIANT[item.source]} size="md">{item.source_label}</Badge>
        <Badge variant={ACTION_BADGE_VARIANT[item.action]} size="md">{item.action_label}</Badge>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">설명</p>
        <p className="mt-2 text-base font-semibold text-gray-900 leading-7">{item.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-1">
        <DetailField label="발생 시각" value={formatDateTime(item.occurred_at)} />
        <DetailField label="수행자" value={actorLabel} />
        <DetailField label="대상" value={targetLabel} />
        <DetailField label="조직" value={item.organization ?? '-'} />
        <DetailField label="ID" value={item.subject_id} mono />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">메타데이터</p>
        {metadataEntries.length ? (
          <div className="mt-3 space-y-2">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{key}</p>
                <p className="mt-1 text-sm text-gray-700 break-words">{String(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
            표시할 메타데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

const DetailField = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="rounded-lg bg-gray-50 px-3 py-2">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    <p className={`mt-1 text-sm text-gray-700 break-words ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
  </div>
);
