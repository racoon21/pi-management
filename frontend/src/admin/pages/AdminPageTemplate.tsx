import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Button } from '../../components/shared/Button';

interface AdminPageTemplateProps {
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
}

export const AdminPageTemplate = ({
  title,
  subtitle,
  description,
  highlights,
}: AdminPageTemplateProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title={title} subtitle={subtitle} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-[#5E3D8F] rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
                <ShieldCheck size={14} />
                Admin
              </div>
              <h2 className="mt-4 text-2xl font-bold">{title}</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/80">{description}</p>
            </div>
            <Button
              variant="secondary"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/graph')}
              className="!bg-white !text-[#5E3D8F] !shrink-0"
            >
              기존 사용자 화면 보기
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">현재 준비 상태</h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              이 페이지는 navigation shell 단계에서 추가된 placeholder 화면입니다. 다음 브랜치에서 실제 API 연결과 기능 구현이 순차적으로 들어올 예정입니다.
            </p>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">다음 구현 항목</h3>
            <ul className="mt-4 space-y-3">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#5E3D8F]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
