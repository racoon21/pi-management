import { useEffect } from 'react';
import { Hourglass, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/authApi';
import { Button } from '../components/shared/Button';

export const PendingApprovalPage = () => {
  const { user, logout, setUser } = useAuthStore();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const updated = await authApi.getMe();
        if (updated.role !== 'none') {
          setUser(updated);
        }
      } catch {
        // ignore polling errors
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [setUser]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Hourglass className="text-amber-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">승인 대기 중</h2>
        <p className="text-gray-500 mb-6">
          관리자의 승인을 기다리고 있습니다.<br />
          승인이 완료되면 자동으로 전환됩니다.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-600 space-y-1">
            <p><span className="font-medium">이름:</span> {user?.name}</p>
            <p><span className="font-medium">사번:</span> {user?.employee_id}</p>
            <p><span className="font-medium">조직:</span> {user?.organization}</p>
          </div>
        </div>

        <Button
          variant="secondary"
          icon={LogOut}
          onClick={handleLogout}
          className="w-full"
        >
          로그아웃
        </Button>
      </div>
    </div>
  );
};
