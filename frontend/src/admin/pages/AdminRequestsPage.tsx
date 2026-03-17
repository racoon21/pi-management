import { AdminPageTemplate } from './AdminPageTemplate';

export const AdminRequestsPage = () => (
  <AdminPageTemplate
    title="운영 요청"
    subtitle="직접 집행 전, 관리자 요청 흐름을 먼저 정리합니다"
    description="기존 user 기능을 급하게 건드리지 않기 위해, Beta 단계에서는 운영 요청을 생성하고 추적하는 구조부터 준비합니다. 실제 role 변경이나 상태 반영은 합의 후 다음 단계에서 연결합니다."
    highlights={[
      '사용자 변경 요청 등록',
      '업무 구조 검토 요청 등록',
      '요청 상태와 처리 이력 추적',
    ]}
  />
);
