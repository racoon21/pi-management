import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

export const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(employeeId, password);
      if (success) {
        navigate('/');
      } else {
        setError('사번 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      setError('로그인에 실패했습니다. 서버 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-base">
      {/* Left Panel - Minimal branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-bg flex-col items-center justify-center p-12">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#7952B3] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">PI</span>
          </div>
          <div>
            <span className="text-white text-2xl font-bold block">SKB</span>
            <span className="text-gray-400 text-sm">PI Management System</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#7952B3] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">PI</span>
            </div>
            <span className="text-white text-xl font-semibold">SKB PI Management</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">로그인</h2>
              <p className="text-gray-400 mt-2">계정 정보를 입력하세요</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="사번"
                type="text"
                placeholder="사번을 입력하세요"
                icon={User}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
              />

              <Input
                label="비밀번호"
                type="password"
                placeholder="비밀번호를 입력하세요"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                icon={LogIn}
                loading={loading}
              >
                로그인
              </Button>
            </form>

          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            계정이 없으신가요?{' '}
            <Link to="/signup" className="text-[#9B7ACC] hover:underline font-medium">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
