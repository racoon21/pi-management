import { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/shared/Badge';
import { adminApi, type UserListItem } from '../../api/adminApi';

const ROLE_OPTIONS = ['viewer', 'editor', 'admin'] as const;

const roleLabel = (role: string) => {
  switch (role) {
    case 'admin': return '관리자';
    case 'editor': return '편집자';
    case 'viewer': return '뷰어';
    case 'none': return '대기';
    default: return role;
  }
};

export const AdminUsersPage = () => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? { role: filter } : undefined;
      const data = await adminApi.getUsers(params);
      setUsers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await adminApi.updateRole(userId, newRole);
      fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '역할 변경 실패');
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await adminApi.toggleActive(userId, !currentActive);
      fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '상태 변경 실패');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="사용자 관리" subtitle="사용자 계정 현황 조회 및 역할 관리" />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Filter */}
        <div className="mb-4 flex gap-2">
          {['', 'none', 'viewer', 'editor', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filter === r
                  ? 'bg-[#7952B3] text-white border-[#7952B3]'
                  : 'bg-card text-gray-400 border-border hover:bg-[#2A2A35]'
              }`}
            >
              {r === '' ? '전체' : roleLabel(r)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#1E1E2A] border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-400">사번</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">이름</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">조직</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">역할</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">가입일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-400">액션</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    로딩 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    사용자가 없습니다
                  </td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
