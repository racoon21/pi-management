import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

export const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [employeeId, setEmployeeId] = useState('admin');
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
    <div className="min-h-screen flex">
      {/* Left Panel - Dark sidebar like Databricks */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-bg flex-col justify-between p-12">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#7952B3] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">PI</span>
            </div>
            <span className="text-white text-xl font-semibold">Management System</span>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="space-y-8">
          <h1 className="text-4xl font-bold text-white leading-tight">
            전사 업무 프로세스<br />
            <span className="text-[#9B7ACC]">통합 관리 시스템</span>
          </h1>
          <p className="text-gray-400 text-lg">
            L1부터 L4까지 계층적 업무 구조를 시각화하고,<br />
            변경 이력을 체계적으로 관리하세요.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#9B7ACC]">1,000+</div>
              <div className="text-gray-500 text-sm mt-1">업무 노드</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#9B7ACC]">10</div>
              <div className="text-gray-500 text-sm mt-1">조직 단위</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-[#9B7ACC]">Real-time</div>
              <div className="text-gray-500 text-sm mt-1">변경 추적</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-gray-600 text-sm">
          © 2024 SK브로드밴드. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#7952B3] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">PI</span>
            </div>
            <span className="text-gray-900 text-xl font-semibold">Management System</span>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">로그인</h2>
              <p className="text-gray-500 mt-2">계정 정보를 입력하세요</p>
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 text-center">
                <span className="font-medium">기본 계정:</span> admin / admin123
              </p>
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            문제가 있으신가요?{' '}
            <a href="#" className="text-[#7952B3] hover:underline">
              관리자에게 문의하세요
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
