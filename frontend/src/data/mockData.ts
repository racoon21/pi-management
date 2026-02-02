import type { TaskGraphItem, TaskDetail, User, TaskHistory } from '../types/task';

// L1 조직 정의 (10개)
const L1_ORGANIZATIONS = [
  { name: '네트워크인프라', team: '인프라운영팀', keywords: ['네트워크', '인프라', '운영'] },
  { name: 'AI/빅데이터', team: 'AI플랫폼팀', keywords: ['AI', '빅데이터', '분석'] },
  { name: '클라우드서비스', team: '클라우드팀', keywords: ['클라우드', 'AWS', 'Azure'] },
  { name: '보안관제', team: '보안팀', keywords: ['보안', '관제', '침해대응'] },
  { name: '고객서비스', team: '고객지원팀', keywords: ['고객', 'CS', '서비스'] },
  { name: '미디어플랫폼', team: '미디어팀', keywords: ['미디어', 'OTT', '콘텐츠'] },
  { name: '기업솔루션', team: 'B2B팀', keywords: ['기업', 'B2B', '솔루션'] },
  { name: '디지털혁신', team: 'DX팀', keywords: ['DX', '혁신', '디지털'] },
  { name: '데이터센터', team: 'IDC팀', keywords: ['IDC', '데이터센터', '호스팅'] },
  { name: '품질관리', team: 'QA팀', keywords: ['품질', 'QA', '테스트'] },
];

// L2 업무 카테고리
const L2_CATEGORIES = ['기획', '개발', '운영', '분석'];

// L3 세부 업무
const L3_SUBCATEGORIES = ['설계', '구현', '검증', '배포'];

// 담당자 목록
const MANAGERS = [
  { name: '김철수', id: 'EMP001' },
  { name: '이영희', id: 'EMP002' },
  { name: '박지민', id: 'EMP003' },
  { name: '최수현', id: 'EMP004' },
  { name: '정민우', id: 'EMP005' },
  { name: '한소연', id: 'EMP006' },
  { name: '강동원', id: 'EMP007' },
  { name: '윤서연', id: 'EMP008' },
  { name: '임재현', id: 'EMP009' },
  { name: '오지은', id: 'EMP010' },
];

// UUID 생성 함수
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Mock 데이터 생성
const generateMockTasks = (): TaskGraphItem[] => {
  const tasks: TaskGraphItem[] = [];

  // Root 노드 (SKB)
  const rootId = generateId();
  tasks.push({
    id: rootId,
    parent_id: null,
    level: 'Root',
    name: 'SKB',
    organization: 'SK브로드밴드',
    team: '전사',
    manager_name: '대표이사',
    manager_id: 'CEO001',
    keywords: ['SKB', '통신', '브로드밴드'],
    is_ai_utilized: false,
  });

  // L1 노드 (10개)
  const l1Ids: string[] = [];
  L1_ORGANIZATIONS.forEach((org) => {
    const l1Id = generateId();
    l1Ids.push(l1Id);
    tasks.push({
      id: l1Id,
      parent_id: rootId,
      level: 'L1',
      name: org.name,
      organization: org.name,
      team: org.team,
      manager_name: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].name,
      manager_id: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].id,
      keywords: org.keywords,
      is_ai_utilized: Math.random() > 0.7,
    });
  });

  // L2, L3, L4 노드 생성 (총 약 1000개의 L4)
  let l4Count = 0;
  const targetL4 = 1000;

  l1Ids.forEach((l1Id, l1Index) => {
    const l1Org = L1_ORGANIZATIONS[l1Index];
    L2_CATEGORIES.forEach((l2Cat) => {
      const l2Id = generateId();
      tasks.push({
        id: l2Id,
        parent_id: l1Id,
        level: 'L2',
        name: `${l1Org.name} ${l2Cat}`,
        organization: l1Org.name,
        team: l1Org.team,
        manager_name: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].name,
        manager_id: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].id,
        keywords: [...l1Org.keywords, l2Cat],
        is_ai_utilized: Math.random() > 0.6,
      });

      L3_SUBCATEGORIES.forEach((l3Sub) => {
        const l3Id = generateId();
        tasks.push({
          id: l3Id,
          parent_id: l2Id,
          level: 'L3',
          name: `${l2Cat} ${l3Sub}`,
          organization: l1Org.name,
          team: l1Org.team,
          manager_name: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].name,
          manager_id: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].id,
          keywords: [...l1Org.keywords, l2Cat, l3Sub],
          is_ai_utilized: Math.random() > 0.5,
        });

        // L4 노드 생성 (각 L3당 약 6-7개)
        const l4PerL3 = Math.ceil((targetL4 - l4Count) / (l1Ids.length * L2_CATEGORIES.length * L3_SUBCATEGORIES.length - tasks.filter(t => t.level === 'L3').length + 1));
        const l4Tasks = [
          '데이터 수집', '모델 학습', '시스템 연동', '보고서 작성', '성능 최적화',
          '모니터링 구축', '자동화 스크립트', '문서화 작업', '테스트 수행', '배포 관리'
        ];

        for (let i = 0; i < Math.min(l4PerL3, 7); i++) {
          if (l4Count >= targetL4) break;

          const l4Id = generateId();
          const taskName = l4Tasks[i % l4Tasks.length];
          tasks.push({
            id: l4Id,
            parent_id: l3Id,
            level: 'L4',
            name: `${l3Sub} - ${taskName}`,
            organization: l1Org.name,
            team: l1Org.team,
            manager_name: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].name,
            manager_id: MANAGERS[Math.floor(Math.random() * MANAGERS.length)].id,
            keywords: [...l1Org.keywords, l2Cat, l3Sub, taskName],
            is_ai_utilized: Math.random() > 0.4,
          });
          l4Count++;
        }
      });
    });
  });

  return tasks;
};

// 생성된 Mock 데이터
export const mockTasks: TaskGraphItem[] = generateMockTasks();

// Task Detail 변환
export const getTaskDetail = (taskId: string): TaskDetail | null => {
  const task = mockTasks.find(t => t.id === taskId);
  if (!task) return null;

  return {
    ...task,
    version: Math.floor(Math.random() * 5) + 1,
    created_by: 'user-001',
    updated_by: 'user-001',
    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
};

// Mock History 생성
export const getTaskHistory = (taskId: string): TaskHistory[] => {
  const task = getTaskDetail(taskId);
  if (!task) return [];

  const histories: TaskHistory[] = [];
  for (let i = 1; i <= task.version; i++) {
    histories.push({
      id: generateId(),
      task_id: taskId,
      snapshot: { ...task, version: i },
      version: i,
      change_type: i === 1 ? 'CREATE' : 'UPDATE',
      changed_by: 'user-001',
      changed_by_name: '관리자',
      changed_at: new Date(Date.now() - (task.version - i) * 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return histories.reverse();
};

// Mock User
export const mockUser: User = {
  id: 'user-001',
  employee_id: 'admin',
  name: '관리자',
  organization: 'SK브로드밴드',
  role: 'admin',
};

// Statistics
export const getMockStats = () => {
  const levelCounts = mockTasks.reduce((acc, task) => {
    acc[task.level] = (acc[task.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const aiUtilizedCount = mockTasks.filter(t => t.is_ai_utilized).length;

  return {
    total: mockTasks.length,
    byLevel: levelCounts,
    aiUtilized: aiUtilizedCount,
    organizations: [...new Set(mockTasks.map(t => t.organization))],
  };
};

console.log('Mock Data Stats:', getMockStats());
