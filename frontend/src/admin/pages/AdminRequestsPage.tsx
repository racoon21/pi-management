import { useState, useEffect, useCallback } from 'react';
import { UserPlus, UserX, Clock } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { adminApi, type UserListItem } from '../../api/adminApi';

export const AdminRequestsPage = () => {
  const [pending, setPending] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPendingUsers();
      setPending(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (userId: string, role: string) => {
    try {
      await adminApi.updateRole(userId, role);
      fetchPending();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '승인 실패');
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await adminApi.toggleActive(userId, false);
      fetchPending();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '거절 실패');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="운영 요청"
        subtitle={`승인 대기 중인 사용자 ${pending.length}명`}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-gray-400 py-12">로딩 중...</div>
        ) : pending.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[#2A2A35] rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">대기 중인 요청이 없습니다</h3>
            <p className="text-gray-400 text-sm">새로운 가입 요청이 들어오면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((u) => (
              <div
                key={u.id}
                className="bg-card rounded-xl border border-border p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-white">{u.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{u.employee_id}</p>
                  </div>
                  <Badge variant="warning" size="sm">대기</Badge>
                </div>

                <div className="text-sm text-gray-400 space-y-1 mb-4">
                  <p><span className="text-gray-400">조직:</span> {u.organization}</p>
                  <p><span className="text-gray-400">가입일:</span> {new Date(u.created_at).toLocaleDateString('ko-KR')}</p>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 flex gap-1">
                    <Button
                      size="sm"
                      icon={UserPlus}
                      onClick={() => handleApprove(u.id, 'viewer')}
                      className="flex-1"
                    >
                      Viewer
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleApprove(u.id, 'editor')}
                      className="flex-1"
                    >
                      Editor
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={UserX}
                    onClick={() => handleReject(u.id)}
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
