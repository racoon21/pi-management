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
      <div className="min-h-screen flex items-center justify-center bg-base p-8">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="text-green-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">가입 완료</h2>
          <p className="text-gray-400 mb-6">
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

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#7952B3] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">PI</span>
            </div>
            <span className="text-white text-xl font-semibold">SKB PI Management</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">회원가입</h2>
              <p className="text-gray-400 mt-2">계정 정보를 입력하세요</p>
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
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
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
            <Link to="/login" className="text-[#9B7ACC] hover:underline font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
