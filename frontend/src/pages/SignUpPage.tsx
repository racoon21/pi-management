import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Building, UserPlus } from 'lucide-react';
import { authApi } from '../api/authApi';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';

export const SignUpPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    employee_id: '',
    name: '',
    organization: '',
    password: '',
    passwordConfirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        employee_id: form.employee_id,
        name: form.name,
        organization: form.organization,
        password: form.password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      if (message.includes('이미 등록된 사번')) {
        setError('이미 등록된 사번입니다.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="text-green-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">가입 완료</h2>
          <p className="text-gray-500 mb-6">
            관리자의 승인 후 서비스를 이용할 수 있습니다.<br />
            승인 전까지 대기 화면이 표시됩니다.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full" size="lg">
            로그인 페이지로 이동
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-bg flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#7952B3] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">PI</span>
            </div>
            <span className="text-white text-xl font-semibold">Management System</span>
          </div>
        </div>
        <div className="space-y-8">
          <h1 className="text-4xl font-bold text-white leading-tight">
            전사 업무 프로세스<br />
            <span className="text-[#9B7ACC]">통합 관리 시스템</span>
          </h1>
          <p className="text-gray-400 text-lg">
            계정을 등록하고 관리자 승인을 받은 후<br />
            시스템을 이용하실 수 있습니다.
          </p>
        </div>
        <div className="text-gray-600 text-sm">
          © 2024 SK브로드밴드. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#7952B3] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">PI</span>
            </div>
            <span className="text-gray-900 text-xl font-semibold">Management System</span>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">회원가입</h2>
              <p className="text-gray-500 mt-2">계정 정보를 입력하세요</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="사번"
                type="text"
                placeholder="사번을 입력하세요"
                icon={User}
                value={form.employee_id}
                onChange={handleChange('employee_id')}
                required
              />
              <Input
                label="이름"
                type="text"
                placeholder="이름을 입력하세요"
                icon={User}
                value={form.name}
                onChange={handleChange('name')}
                required
              />
              <Input
                label="소속 조직"
                type="text"
                placeholder="소속 조직을 입력하세요"
                icon={Building}
                value={form.organization}
                onChange={handleChange('organization')}
                required
              />
              <Input
                label="비밀번호"
                type="password"
                placeholder="비밀번호 (6자 이상)"
                icon={Lock}
                value={form.password}
                onChange={handleChange('password')}
                required
              />
              <Input
                label="비밀번호 확인"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                icon={Lock}
                value={form.passwordConfirm}
                onChange={handleChange('passwordConfirm')}
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
                icon={UserPlus}
                loading={loading}
              >
                가입 신청
              </Button>
            </form>
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-[#7952B3] hover:underline font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
