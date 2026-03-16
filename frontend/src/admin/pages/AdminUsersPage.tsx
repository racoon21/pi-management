import { AdminPageTemplate } from './AdminPageTemplate';

export const AdminUsersPage = () => (
  <AdminPageTemplate
    title="사용자 관리"
    subtitle="기존 사용자 계정 현황을 조회하고 운영 요청을 준비합니다"
    description="Beta 초기 단계에서는 읽기 전용 사용자 디렉터리부터 연결합니다. 이후 브랜치에서 role 변경 요청과 활성/비활성 요청 흐름을 단계적으로 붙일 예정입니다."
    highlights={[
      '사용자 목록과 검색/필터 UI',
      'role, 조직, 활성 여부 조회',
      '향후 role 변경 요청 진입점 추가',
    ]}
  />
);
