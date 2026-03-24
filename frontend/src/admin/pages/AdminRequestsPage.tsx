import { useCallback, useEffect, useState } from 'react';
import { Activity, Clock, RefreshCw, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react';
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

type FeedbackState = {
  message: string;
  action: AdminUserAction;
  auditLogId: string | null;
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

export const AdminRequestsPage = () => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPendingUsers();
      setPending(data);
    } catch (error) {
      toast.error(getErrorMessage(error, '승인 대기 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const handleActionResult = async (result: AdminUserActionResult, successFallback: string) => {
    const message = result.message ?? successFallback;
    toast.success(message);
    setFeedback({
      message,
      action: result.data.action,
      auditLogId: result.data.audit_log_id,
    });
    await fetchPending();
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
        title="운영 요청"
        subtitle={`승인 대기 중인 계정 ${pending.length}명 · 처리 후 감사 로그로 바로 연결됩니다.`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section className="rounded-2xl border border-[#7952B3]/15 bg-[#F8F4FF] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">승인/거절 처리 후 바로 로그를 확인할 수 있습니다.</h2>
              <p className="mt-1 text-sm text-gray-600">
                운영 요청은 단순 상태 변경으로 끝나지 않고, 관리자 감사 로그에 남겨 같은 화면 흐름 안에서 바로 추적할 수 있도록 연결됩니다.
              </p>
            </div>
            <Button icon={RefreshCw} variant="secondary" onClick={() => void fetchPending()} loading={loading}>
              요청 새로고침
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
                <p className="mt-1 text-sm text-emerald-700">처리 결과가 관리자 감사 로그에 기록되었습니다.</p>
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

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-400 shadow-sm">
            승인 대기 요청을 불러오는 중입니다...
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Clock className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-700">대기 중인 요청이 없습니다.</h3>
            <p className="mt-2 text-sm text-gray-400">새로운 가입 요청이 들어오면 이 화면에서 승인 또는 거절을 처리할 수 있습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((user) => (
              <div key={user.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                    <p className="mt-1 font-mono text-sm text-gray-500">{user.employee_id}</p>
                  </div>
                  <Badge variant="warning" size="sm">승인 대기</Badge>
                </div>

                <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-900">조직</span>
                    <span className="ml-2">{user.organization}</span>
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">가입일</span>
                    <span className="ml-2">{new Date(user.created_at).toLocaleDateString('ko-KR')}</span>
                  </p>
                  <p className="flex items-center gap-2 text-amber-700">
                    <UserPlus size={14} />
                    승인 처리 후 감사 로그에 자동 기록됩니다.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
