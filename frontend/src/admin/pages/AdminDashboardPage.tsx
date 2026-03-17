import { AdminPageTemplate } from './AdminPageTemplate';

export const AdminDashboardPage = () => (
  <AdminPageTemplate
    title="관리자 홈"
    subtitle="운영 현황과 핵심 지표를 한눈에 확인합니다"
    description="같은 포털 안에서 admin 계정에게만 열리는 시작 화면입니다. 사용자 현황, 업무 변화, 운영 요청 상태를 이 화면에서 요약해서 보여줄 예정입니다."
    highlights={[
      '전체 사용자 수와 role 분포 요약 카드',
      '최근 업무 변경 이력 요약',
      '운영 요청 현황과 빠른 이동 액션',
    ]}
  />
);
