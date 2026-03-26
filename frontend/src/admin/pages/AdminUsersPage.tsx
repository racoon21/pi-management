import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import {
  adminApi,
  type AdminUserAction,
  type AdminUserActionResult,
  type UserListItem,
} from '../../api/adminApi';

const ROLE_OPTIONS = [
  { value: 'viewer', label: '조회자' },
  { value: 'editor', label: '편집자' },
  { value: 'admin', label: '관리자' },
] as const;

const FILTER_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'none', label: '승인 대기' },
  { value: 'viewer', label: '조회자' },
  { value: 'editor', label: '편집자' },
  { value: 'admin', label: '관리자' },
] as const;

type FeedbackState = {
  message: string;
  action: AdminUserAction;
  auditLogId: string | null;
};

const roleLabel = (role: string) => {
  switch (role) {
    case 'admin':
      return '관리자';
    case 'editor':
      return '편집자';
    case 'viewer':
      return '조회자';
    case 'none':
      return '승인 대기';
    default:
      return role;
  }
};

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case 'admin':
      return 'danger' as const;
    case 'editor':
      return 'primary' as const;
    case 'viewer':
      return 'success' as const;
    case 'none':
      return 'warning' as const;
    default:
      return 'default' as const;
  }
};

const actionLabel = (action: AdminUserAction) => {
  switch (action) {
    case 'USER_APPROVED':
      return '가입 승인';
    case 'USER_REJECTED':
      return '가입 거절';
    case 'USER_ROLE_CHANGED':
      return '역할 변경';
    case 'USER_ACTIVATED':
      return '계정 활성';
    case 'USER_DEACTIVATED':
      return '계정 비활성';
    default:
      return action;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

export const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? { role: filter } : undefined;
      const data = await adminApi.getUsers(params);
      setUsers(data);
    } catch (error) {
      toast.error(getErrorMessage(error, '사용자 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const summary = useMemo(() => {
    const activeCount = users.filter((user) => user.is_active).length;
    const pendingCount = users.filter((user) => user.role === 'none').length;
    return {
      total: users.length,
      active: activeCount,
      inactive: users.length - activeCount,
      pending: pendingCount,
    };
  }, [users]);

  const handleActionResult = async (result: AdminUserActionResult, successFallback: string) => {
    const message = result.message ?? successFallback;
    toast.success(message);
    setFeedback({
      message,
      action: result.data.action,
      auditLogId: result.data.audit_log_id,
    });
    await fetchUsers();
  };

  const handleRoleChange = async (user: UserListItem, newRole: string) => {
    if (user.role === newRole) return;

    const key = `${user.id}:role:${newRole}`;
    setProcessingKey(key);
    try {
      const result = await adminApi.updateRole(user.id, newRole);
      await handleActionResult(result, `"${user.name}" 역할을 변경했습니다.`);
    } catch (error) {
      toast.error(getErrorMessage(error, '역할 변경에 실패했습니다.'));
    } finally {
      setProcessingKey(null);
    }
  };

  const handleToggleActive = async (user: UserListItem) => {
    const nextActive = !user.is_active;
    const key = `${user.id}:active:${nextActive ? 'on' : 'off'}`;
    setProcessingKey(key);
    try {
      const result = await adminApi.toggleActive(user.id, nextActive);
      await handleActionResult(
        result,
        `"${user.name}" 계정을 ${nextActive ? '활성화' : '비활성화'}했습니다.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, '계정 상태 변경에 실패했습니다.'));
    } finally {
      setProcessingKey(null);
    }
  };

  const handleApprove = async (user: UserListItem, role: 'viewer' | 'editor') => {
    const key = `${user.id}:approve:${role}`;
    setProcessingKey(key);
    try {
      const result = await adminApi.approvePendingUser(user.id, role);
      await handleActionResult(result, `"${user.name}" 계정을 승인했습니다.`);
    } catch (error) {
      toast.error(getErrorMessage(error, '계정 승인에 실패했습니다.'));
    } finally {
      setProcessingKey(null);
    }
  };

  const handleReject = async (user: UserListItem) => {
    const key = `${user.id}:reject`;
    setProcessingKey(key);
    try {
      const result = await adminApi.rejectPendingUser(user.id);
      await handleActionResult(result, `"${user.name}" 가입 요청을 거절했습니다.`);
    } catch (error) {
      toast.error(getErrorMessage(error, '가입 요청 거절에 실패했습니다.'));
    } finally {
      setProcessingKey(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="사용자 관리"
        subtitle="역할 변경, 활성 토글, 승인 처리를 감사 로그와 연결해 관리합니다."
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="rounded-2xl border border-[#7952B3]/15 bg-[#F8F4FF] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">사용자 변경 흐름이 활동 로그와 바로 연결됩니다.</h2>
              <p className="mt-1 text-sm text-gray-600">
                역할 변경, 계정 활성/비활성, 승인/거절 처리 후 토스트 메시지를 보여주고, 최근 처리 결과를 활동 로그에서 바로 확인할 수 있습니다.
              </p>
            </div>
            <Button icon={RefreshCw} variant="secondary" onClick={() => void fetchUsers()} loading={loading}>
              목록 새로고침
            </Button>
          </div>
        </section>

        {feedback && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" size="md">최근 처리</Badge>
                  <Badge variant="primary" size="md">{actionLabel(feedback.action)}</Badge>
                </div>
                <p className="mt-3 text-base font-semibold text-emerald-900">{feedback.message}</p>
                <p className="mt-1 text-sm text-emerald-700">감사 로그가 기록되었습니다. 필요하면 바로 활동 로그 상세로 이동해 확인할 수 있습니다.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {feedback.auditLogId && (
                  <Button
                    icon={Activity}
                    onClick={() => navigate('/admin/logs', { state: { selectedActivityId: feedback.auditLogId } })}
                  >
                    활동 로그에서 확인
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setFeedback(null)}>
                  닫기
                </Button>
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="현재 목록 사용자" value={`${summary.total}명`} tone="bg-[#7952B3]" />
          <SummaryCard label="활성 계정" value={`${summary.active}명`} tone="bg-emerald-500" />
          <SummaryCard label="비활성 계정" value={`${summary.inactive}명`} tone="bg-slate-500" />
          <SummaryCard label="승인 대기" value={`${summary.pending}명`} tone="bg-amber-500" />
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">역할 필터</h3>
            <p className="mt-1 text-sm text-gray-500">필터링한 목록에서 역할 변경과 상태 전환을 바로 처리할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  filter === option.value
                    ? 'bg-[#7952B3] text-white border-[#7952B3]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">사번</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">조직</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">역할</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">가입일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">액션</th>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-[#2A2A35]">
                    <td className="px-4 py-3 font-mono text-gray-300">{u.employee_id}</td>
                    <td className="px-4 py-3 text-white">{u.name}</td>
                    <td className="px-4 py-3 text-gray-400">{u.organization}</td>
                    <td className="px-4 py-3">
                      {u.role === 'none' ? (
                        <Badge variant="warning" size="sm">대기</Badge>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="text-xs border border-border rounded bg-[#1E1E2A] text-gray-300 px-2 py-1"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{roleLabel(r)}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? 'success' : 'danger'} size="sm">
                        {u.is_active ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {u.role === 'none' && (
                          <button
                            onClick={() => handleRoleChange(u.id, 'viewer')}
                            className="text-xs px-2 py-1 bg-[#7952B3] text-white rounded hover:bg-[#6a46a0] transition-colors"
                          >
                            승인
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          className="text-xs px-2 py-1 border border-border rounded hover:bg-[#2A2A35] text-gray-300 transition-colors"
                        >
                          {u.is_active ? '비활성화' : '활성화'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const rowBusy = processingKey?.startsWith(`${user.id}:`) ?? false;
                    return (
                      <tr key={user.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-gray-700 whitespace-nowrap">{user.employee_id}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">{user.name}</p>
                          {user.role === 'none' && (
                            <p className="mt-1 text-xs text-amber-600">승인 또는 거절 처리가 필요한 계정입니다.</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{user.organization}</td>
                        <td className="px-4 py-4">
                          {user.role === 'none' ? (
                            <Badge variant={roleBadgeVariant(user.role)} size="sm">
                              {roleLabel(user.role)}
                            </Badge>
                          ) : (
                            <select
                              value={user.role}
                              disabled={rowBusy}
                              onChange={(event) => void handleRoleChange(user, event.target.value)}
                              className="min-w-[120px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#7952B3] focus:outline-none focus:ring-2 focus:ring-[#7952B3]/20 disabled:bg-gray-100"
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={user.is_active ? 'success' : 'danger'} size="sm">
                            {user.is_active ? '활성' : '비활성'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-gray-500 whitespace-nowrap">
                          {new Date(user.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-4">
                          {user.role === 'none' ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                icon={UserCheck}
                                loading={processingKey === `${user.id}:approve:viewer`}
                                onClick={() => void handleApprove(user, 'viewer')}
                              >
                                조회자 승인
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={ShieldCheck}
                                loading={processingKey === `${user.id}:approve:editor`}
                                onClick={() => void handleApprove(user, 'editor')}
                              >
                                편집자 승인
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={UserX}
                                loading={processingKey === `${user.id}:reject`}
                                onClick={() => void handleReject(user)}
                              >
                                거절
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant={user.is_active ? 'secondary' : 'primary'}
                                icon={user.is_active ? ShieldOff : ShieldCheck}
                                loading={
                                  processingKey === `${user.id}:active:off` ||
                                  processingKey === `${user.id}:active:on`
                                }
                                onClick={() => void handleToggleActive(user)}
                              >
                                {user.is_active ? '비활성화' : '활성화'}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex items-center gap-4">
      <div className={`h-11 w-11 rounded-xl ${tone}`} />
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);
