import { AdminPageTemplate } from './AdminPageTemplate';

export const AdminLogsPage = () => (
  <AdminPageTemplate
    title="활동 로그"
    subtitle="최근 변경 내역과 관리자 활동 기록을 추적합니다"
    description="우선은 task history 기반의 최근 변경 내역을 조회하는 방향으로 시작합니다. 이후에는 관리자 활동 로그를 별도 데이터로 저장해 운영 흔적을 남길 예정입니다."
    highlights={[
      '최근 업무 변경 이력 목록',
      '변경 사용자와 시간 기준 필터',
      '향후 관리자 활동 로그 추가',
    ]}
  />
);
