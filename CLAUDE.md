# PI 내역 자산화 및 Tracking 관리 시스템 PRD (v5)

> **이 문서는 AI 코딩 어시스턴트(Codex, Claude, Cursor 등)와 함께 개발하기 위해 최적화된 명세서입니다.**
> 코드 수정 시 이 문서를 먼저 읽고 전체 구조를 파악한 뒤 작업해 주세요.
> 최종 업데이트: 2026-03-11

---

## 1. 프로젝트 개요

### 1.1 목표

본사 업무를 Root → L1 → L2 → L3 → L4 단계로 계층화하여 인터랙티브 그래프로 시각화하고, 모든 변경 이력을 스냅샷(Audit Log)으로 자산화하는 웹 시스템.

### 1.2 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React 19 + TypeScript + Vite)            │
│  - ReactFlow v11 (그래프 시각화)                     │
│  - Zustand (상태 관리)                               │
│  - TanStack React Query (서버 상태 캐싱)             │
│  - Tailwind CSS v4 (스타일링)                        │
├─────────────────────────────────────────────────────┤
│  Backend (FastAPI + SQLAlchemy 2.0 Async)           │
│  - Pydantic v2 (데이터 검증)                         │
│  - JWT 인증 (Access 15분 + Refresh 7일)              │
│  - Rate Limiting (로그인 5회/분)                     │
├─────────────────────────────────────────────────────┤
│  Database (PostgreSQL 15)                           │
│  - asyncpg 드라이버                                  │
│  - PgBouncer 호환 (NullPool + statement_cache=0)    │
│  - JSONB 스냅샷, GIN 인덱스                          │
└─────────────────────────────────────────────────────┘
```

### 1.3 운영 환경

| 항목 | 값 |
|------|-----|
| 데이터 규모 | 노드 약 3,000개 이상 |
| 동시 접속 | 20~50명 |
| 배포 | Cloudflare Pages (FE) + Render (BE) + Supabase (DB) |

---

## 2. 페이지별 주요 기능 상세

### 2.1 로그인 페이지 (`LoginPage.tsx`)

- **경로**: `/login`
- **파일**: `frontend/src/pages/LoginPage.tsx`
- **공개 접근**: 인증 불필요

| 기능 | 설명 |
|------|------|
| 사번/비밀번호 로그인 | `authApi.login(employeeId, password)` 호출, JWT 토큰 쌍 발급 |
| 토큰 저장 | Zustand `authStore`에 accessToken/refreshToken 저장, `localStorage` persist |
| 로그인 후 리다이렉트 | 성공 시 `/` (대시보드)로 이동 |
| 에러 표시 | 잘못된 자격증명 시 인라인 에러 메시지 표시 |
| 로딩 상태 | 로그인 요청 중 버튼 비활성화 + 스피너 |

**UI 레이아웃**:
- 2열 분할: 좌측 SK Broadband 브랜딩 사이드바(다크) + 우측 로그인 폼(라이트)
- 모바일에서는 사이드바 숨김

**사용 컴포넌트**: `Input`(icon 지원), `Button`(loading 상태)
**상태**: 로컬 state (employeeId, password, loading, error)

---

### 2.2 대시보드 페이지 (`DashboardPage.tsx`)

- **경로**: `/` (홈)
- **파일**: `frontend/src/pages/DashboardPage.tsx`
- **인증 필요**: `ProtectedRoute` 래핑

| 기능 | 설명 |
|------|------|
| KPI 통계 카드 (4개) | 전체 노드 수, AI 활용률(%), 조직 수, L4 태스크 수 |
| 레벨 분포 차트 | Root~L4 수평 바 차트 (태스크 수 및 퍼센트 표시) |
| 퀵 액션 버튼 (3개) | 태스크 그래프 보기, AI 활용 필터, 변경 이력 보기 |
| 최근 태스크 테이블 | 최근 5건 표시 (레벨 배지, 이름, 조직, 담당자, AI 여부) |
| 환영 배너 | 사용자 이름 표시, 그래프 페이지 바로가기 CTA |

**데이터 처리**:
- `useTaskStore.fetchTasks()`로 전체 태스크 로드
- `useMemo`로 통계 계산 (레벨별 그룹핑, AI 활용 카운트, 조직 유니크 수)
- `useAuthStore.user`로 사용자 정보 표시

**사용 컴포넌트**: StatCard, QuickActionButton, Badge
**아이콘**: Network, Sparkles, Building, TrendingUp, BarChart3, PieChart (lucide-react)

---

### 2.3 그래프 페이지 (`GraphPage.tsx`)

- **경로**: `/graph`, `/tasks`, `/history`
- **파일**: `frontend/src/pages/GraphPage.tsx`
- **인증 필요**: `ProtectedRoute` 래핑
- **핵심 페이지**: 시스템의 메인 기능

| 기능 | 설명 |
|------|------|
| 인터랙티브 그래프 | ReactFlow 기반 계층형 태스크 트리 시각화 |
| 하이브리드 레이아웃 | Root→L1→L2: 방사형(Radial), L2→L3→L4: 계층형(Hierarchical) |
| 노드 확장/축소 | 클릭 시 하위 노드 토글, 전체 확장/축소 버튼 |
| 필터링 | 조직, 레벨, AI 활용 여부로 필터 (필터 시 조상 노드 자동 유지) |
| 노드 선택 | 클릭 시 우측 DetailSidebar 에 상세 정보 표시 |
| 태스크 CRUD | 생성(하위 추가), 수정(모달), 삭제(확인 모달) |
| 변경 이력 | 태스크별 변경 히스토리 조회 (HistoryModal) |
| 줌/팬 | 0.1x~2.5x 줌, 미니맵 네비게이션, 줌 컨트롤 |

**레이아웃 구조**: FilterBar(상단) + TaskGraph(좌측 flex-1) + DetailSidebar(우측 w-96, 조건부)

**하위 컴포넌트** (`frontend/src/components/graph/`):

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `TaskGraph` | `TaskGraph.tsx` | ReactFlow 컨테이너, 레이아웃 계산, 필터링 로직 |
| `TaskNode` | `TaskNode.tsx` | 커스텀 노드 (레벨별 색상, AI 배지, 자식 수 표시) |
| `MinDistanceEdge` | `MinDistanceEdge.tsx` | 커스텀 엣지 (최소 거리 기반 곡선 경로) |
| `FilterBar` | `FilterBar.tsx` | 조직/레벨/AI 필터 드롭다운, 전체 확장/축소 |
| `DetailSidebar` | `DetailSidebar.tsx` | 우측 상세 패널 (정보 탭 + 이력 탭) |
| `DetailPanel` | `DetailPanel.tsx` | 태스크 상세 정보 표시 |
| `TaskFormModal` | `TaskFormModal.tsx` | 태스크 생성/수정 모달 폼 |
| `HistoryModal` | `HistoryModal.tsx` | 변경 이력 모달 |
| `ContextMenu` | `ContextMenu.tsx` | 우클릭 컨텍스트 메뉴 |
| `GlobalModal` | `GlobalModal.tsx` | 모달 타입 라우팅 (confirm/edit/create/delete/history) |

**노드 위치 알고리즘** (`frontend/src/utils/layout.ts`):
- L1 노드: Root 중심 400px 반경 원형 배치
- L2 노드: Root 중심 800px 반경 원형 배치
- L3 노드: 부모 L2에서 240px 외측 배치
- L4 노드: 부모 L3에서 220px 외측 배치 (4개 초과 시 2열 그리드)

**레벨별 노드 색상**:

| 레벨 | 색상 | HEX |
|------|------|-----|
| Root | 보라색 | `#8E72EE` |
| L1 | 청록색 | `#00D7D2` |
| L2 | 다크 | `#191927` |
| L3 | 보라색 | `#7259D9` |
| L4 | 라이트 | `#E4E3EC` |

**필터링 로직**:
- 필터 매칭 노드 + 해당 노드의 모든 조상(ancestor) 노드를 유지
- 나머지 노드는 블러/반투명 처리

---

### 2.4 업로드 페이지 (`UploadPage.tsx`)

- **경로**: `/upload`
- **파일**: `frontend/src/pages/UploadPage.tsx`
- **인증 필요**: `ProtectedRoute` 래핑

**4단계 워크플로우**:

| 단계 | 이름 | 설명 |
|------|------|------|
| Step 1 | 업로드 | 드래그 앤 드롭 또는 클릭으로 .xlsx/.xls 파일 선택 (최대 10MB) |
| Step 2 | 미리보기 | 파일 정보 + 레벨별 개수 요약 배지 + 상위 10행 테이블 미리보기 |
| Step 3 | 비교(Diff) | DB 데이터와 비교하여 신규/기존 분류, 계층형 트리 뷰로 표시 |
| Step 4 | 결과 | 생성/스킵/전체 통계 표시, 그래프 보기 또는 재업로드 선택 |

**API 호출 순서**:
1. `uploadApi.preview(file)` → 엑셀 파싱 및 구조 확인
2. `uploadApi.diff(file)` → DB와 비교 결과 반환
3. `uploadApi.confirm(file)` → 신규 데이터 DB 반영

**핵심 UI 컴포넌트**:
- 드래그 앤 드롭 영역 (FileUpload)
- 스텝 인디케이터 (진행 상태 시각화)
- DiffTreeNode: 재귀적 트리 노드 컴포넌트 (신규/기존 배지 표시)
- 결과 통계 카드

**상태**: 로컬 state (step, file, preview, diff, result, error, loading)

---

## 3. 프로젝트 디렉토리 구조

```
pi-management/
├── backend/
│   └── app/
│       ├── main.py                    # FastAPI 앱 진입점 (CORS, 라우터 등록)
│       ├── main_dev.py                # 개발용 진입점
│       ├── core/
│       │   ├── config.py              # 환경설정 (DATABASE_URL, JWT_SECRET 등)
│       │   ├── security.py            # JWT 생성/검증, bcrypt 해싱
│       │   └── rate_limit.py          # 엔드포인트별 Rate Limiting
│       ├── models/
│       │   ├── user.py                # User ORM 모델
│       │   └── task.py                # Task, TaskHistory ORM 모델
│       ├── schemas/
│       │   ├── task.py                # TaskCreate, TaskUpdate, TaskDetail, TaskGraphItem
│       │   ├── user.py                # User Pydantic 스키마
│       │   ├── common.py              # ApiResponse 공통 래퍼
│       │   └── upload.py              # UploadPreview, DiffResult, UpsertResult
│       ├── api/
│       │   ├── auth.py                # POST /login, /refresh, /logout, GET /me
│       │   ├── tasks.py               # GET /graph, GET|POST|PUT|DELETE /{id}
│       │   ├── upload.py              # POST /upload (엑셀 업로드)
│       │   └── deps.py                # 의존성 주입 (get_db, get_current_user)
│       ├── services/
│       │   ├── task_service.py        # Task CRUD 비즈니스 로직 (이력 생성 포함)
│       │   └── upload_service.py      # 엑셀 파싱, Diff, Upsert 로직
│       └── db/
│           ├── session.py             # AsyncSession, Engine 설정 (NullPool)
│           └── seed.py                # 초기 데이터 시드 (admin 계정 + 샘플 태스크)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # React Router 설정, QueryClient Provider
│   │   ├── main.tsx                   # ReactDOM 진입점
│   │   ├── index.css                  # Tailwind CSS 전역 스타일
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx          # 로그인 페이지
│   │   │   ├── DashboardPage.tsx      # 대시보드 (KPI, 통계, 퀵 액션)
│   │   │   ├── GraphPage.tsx          # 그래프 시각화 메인 페이지
│   │   │   └── UploadPage.tsx         # 엑셀 업로드 (4단계 워크플로우)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── MainLayout.tsx     # 전체 레이아웃 (사이드바 + 콘텐츠)
│   │   │   │   ├── Sidebar.tsx        # 좌측 네비게이션 (접기/펼치기 지원)
│   │   │   │   └── Header.tsx         # 페이지 헤더
│   │   │   ├── graph/
│   │   │   │   ├── TaskGraph.tsx      # ReactFlow 그래프 컨테이너
│   │   │   │   ├── TaskNode.tsx       # 커스텀 노드 컴포넌트
│   │   │   │   ├── MinDistanceEdge.tsx # 커스텀 엣지 (최소 거리 연결선)
│   │   │   │   ├── FilterBar.tsx      # 필터 바 (조직/레벨/AI)
│   │   │   │   ├── DetailSidebar.tsx  # 우측 상세 사이드바
│   │   │   │   ├── DetailPanel.tsx    # 태스크 상세 정보 패널
│   │   │   │   ├── TaskFormModal.tsx  # 태스크 생성/수정 모달
│   │   │   │   ├── HistoryModal.tsx   # 변경 이력 모달
│   │   │   │   ├── ContextMenu.tsx    # 우클릭 컨텍스트 메뉴
│   │   │   │   └── GlobalModal.tsx    # 모달 타입별 라우팅
│   │   │   ├── shared/
│   │   │   │   ├── Button.tsx         # 버튼 (primary/secondary/danger/ghost)
│   │   │   │   ├── Input.tsx          # 폼 인풋 (아이콘 지원)
│   │   │   │   ├── Modal.tsx          # 베이스 모달
│   │   │   │   ├── ConfirmModal.tsx   # 확인 다이얼로그
│   │   │   │   └── Badge.tsx          # 상태 배지 (default/primary/success/warning/danger/ai)
│   │   │   └── ProtectedRoute.tsx     # 인증 가드
│   │   ├── stores/
│   │   │   ├── authStore.ts           # 인증 상태 (토큰, 유저, login/logout)
│   │   │   ├── taskStore.ts           # 태스크 상태 (목록, 선택, 필터, CRUD)
│   │   │   └── modalStore.ts          # 모달 UI 상태
│   │   ├── api/
│   │   │   ├── client.ts              # Axios 인스턴스 (JWT 인터셉터, 401 처리)
│   │   │   ├── authApi.ts             # 인증 API 함수
│   │   │   ├── taskApi.ts             # 태스크 API 함수
│   │   │   └── uploadApi.ts           # 업로드 API 함수
│   │   ├── types/
│   │   │   └── task.ts                # TaskGraphItem, TaskDetail, TaskHistory 등
│   │   ├── utils/
│   │   │   └── layout.ts             # 하이브리드 레이아웃 알고리즘 (Radial + Hierarchical)
│   │   ├── data/
│   │   │   └── mockData.ts           # 목 데이터 (개발/테스트용)
│   │   └── assets/                    # 정적 리소스
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts                 # Vite 설정 (API 프록시 포함)
│
├── docker-compose.yml                 # PostgreSQL + Backend + Frontend 오케스트레이션
├── Dockerfile.render                  # 프로덕션 빌드 (Render 배포용)
├── render.yaml                        # Render IaC 설정
├── DEPLOYMENT.md                      # 배포 가이드
├── DEVELOPMENT_LOG.md                 # 개발 진행 로그
├── guide_v4.md                        # 이전 버전 PRD
└── guide_v5.md                        # 현재 문서
```

---

## 4. 라우팅 구성

**파일**: `frontend/src/App.tsx`

```
/login              → LoginPage            (공개)
/                   → DashboardPage         (인증 필요, MainLayout 래핑)
/graph              → GraphPage             (인증 필요, MainLayout 래핑)
/tasks              → GraphPage             (인증 필요, /graph 별칭)
/history            → GraphPage             (인증 필요, /graph 별칭)
/users              → DashboardPage         (인증 필요, 미구현 - 홈 별칭)
/settings           → DashboardPage         (인증 필요, 미구현 - 홈 별칭)
/upload             → UploadPage            (인증 필요, MainLayout 래핑)
*                   → / 리다이렉트           (catch-all)
```

**인증 흐름**:
1. `ProtectedRoute`가 `authStore.isAuthenticated` 확인
2. 미인증 시 `/login`으로 리다이렉트
3. API 401 응답 시 자동 로그아웃 + `/login` 이동

---

## 5. 상태 관리 (Zustand Stores)

### 5.1 authStore (`frontend/src/stores/authStore.ts`)

| 상태 | 타입 | 설명 |
|------|------|------|
| `accessToken` | `string \| null` | JWT 액세스 토큰 |
| `refreshToken` | `string \| null` | JWT 리프레시 토큰 |
| `user` | `User \| null` | 현재 로그인 사용자 정보 |
| `isAuthenticated` | `boolean` | 인증 여부 |

| 액션 | 설명 |
|------|------|
| `login(employeeId, password)` | API 호출 → 토큰 저장 → 사용자 정보 페칭 |
| `logout()` | 상태 초기화 |
| `fetchUser()` | `/auth/me` 호출하여 사용자 정보 갱신 |

**persist**: `localStorage` 키 `auth-storage`

### 5.2 taskStore (`frontend/src/stores/taskStore.ts`)

| 상태 | 타입 | 설명 |
|------|------|------|
| `tasks` | `TaskGraphItem[]` | 전체 태스크 목록 (Flat List) |
| `selectedTaskId` | `string \| null` | 선택된 태스크 ID |
| `selectedTask` | `TaskDetail \| null` | 선택된 태스크 상세 |
| `expandedNodes` | `Set<string>` | 확장된 노드 ID 집합 |
| `isLoading` | `boolean` | 로딩 상태 |
| `error` | `string \| null` | 에러 메시지 |
| `filters` | `{organization, level, isAiUtilized}` | 필터 조건 |

| 액션 | 설명 |
|------|------|
| `fetchTasks()` | `/tasks/graph` 호출 → tasks 저장 |
| `selectTask(taskId)` | 태스크 선택 → 상세 정보 페칭 |
| `toggleExpand(nodeId)` | 노드 확장/축소 토글 |
| `expandAll()` / `collapseAll()` | 전체 확장/축소 |
| `setFilters(filters)` | 필터 조건 변경 |
| `createTask(data)` | POST → 새 태스크 생성 |
| `updateTask(taskId, updates)` | PUT → 태스크 수정 (이력 자동 생성) |
| `deleteTask(taskId)` | DELETE → Soft Delete |

### 5.3 modalStore (`frontend/src/stores/modalStore.ts`)

| 상태 | 타입 | 설명 |
|------|------|------|
| `isOpen` | `boolean` | 모달 오픈 여부 |
| `type` | `'confirm' \| 'edit' \| 'create' \| 'delete' \| 'history' \| null` | 모달 타입 |
| `data` | `any` | 모달에 전달할 데이터 |
| `onConfirm` / `onCancel` | `() => void` | 콜백 |

---

## 6. 데이터 모델

### 6.1 데이터베이스 스키마

#### users 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID (PK) | gen_random_uuid() |
| `employee_id` | VARCHAR(20) UNIQUE | 사번 |
| `password_hash` | VARCHAR(255) | bcrypt 해시 |
| `name` | VARCHAR(50) | 이름 |
| `organization` | VARCHAR(100) | 소속 조직 |
| `role` | VARCHAR(20) | admin / editor / viewer |
| `is_active` | BOOLEAN | 활성 상태 |
| `created_at` | TIMESTAMPTZ | 생성일시 |

#### tasks 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID (PK) | gen_random_uuid() |
| `parent_id` | UUID (FK → tasks.id, nullable) | 상위 태스크 (ON DELETE RESTRICT) |
| `level` | VARCHAR | Root / L1 / L2 / L3 / L4 |
| `name` | VARCHAR(200) | 태스크명 |
| `organization` | VARCHAR(100) | 담당 조직 |
| `team` | VARCHAR(100) | 팀 (nullable) |
| `manager_name` | VARCHAR(50) | 담당자명 (nullable) |
| `manager_id` | VARCHAR(20) | 담당자 사번 (nullable) |
| `keywords` | TEXT[] | 키워드 배열 (GIN 인덱스) |
| `is_ai_utilized` | BOOLEAN | AI 활용 여부 (기본 false) |
| `version` | INTEGER | 낙관적 잠금용 버전 (기본 1) |
| `created_by` | UUID (FK → users.id) | 생성자 |
| `updated_by` | UUID (FK → users.id) | 수정자 |
| `created_at` | TIMESTAMPTZ | 생성일시 |
| `updated_at` | TIMESTAMPTZ | 수정일시 |
| `deleted_at` | TIMESTAMPTZ (nullable) | Soft Delete 시점 |

**인덱스**: `parent_id`, `level`, `organization`, `keywords`(GIN)

#### task_histories 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID (PK) | gen_random_uuid() |
| `task_id` | UUID (FK → tasks.id) | 대상 태스크 |
| `snapshot` | JSONB | 변경 시점 전체 데이터 스냅샷 |
| `version` | INTEGER | 버전 번호 |
| `change_type` | VARCHAR(20) | CREATE / UPDATE / DELETE |
| `changed_by` | UUID (FK → users.id) | 변경자 |
| `changed_at` | TIMESTAMPTZ | 변경일시 |

**인덱스**: `task_id`, `changed_at DESC`

### 6.2 TypeScript 타입 정의

**파일**: `frontend/src/types/task.ts`

```typescript
type TaskLevel = 'Root' | 'L1' | 'L2' | 'L3' | 'L4';

interface TaskGraphItem {
  id: string;
  parent_id: string | null;
  level: TaskLevel;
  name: string;
  organization: string;
  team: string | null;
  manager_name: string | null;
  manager_id: string | null;
  keywords: string[] | null;
  is_ai_utilized: boolean;
}

interface TaskDetail extends TaskGraphItem {
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskHistory {
  id: string;
  task_id: string;
  snapshot: TaskDetail;
  version: number;
  change_type: 'CREATE' | 'UPDATE' | 'DELETE';
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

interface User {
  id: string;
  employee_id: string;
  name: string;
  organization: string;
  role: 'admin' | 'editor' | 'viewer';
}
```

---

## 7. API 명세

### 7.1 공통 응답 래퍼

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  error_code?: string;
}
```

### 7.2 인증 API

| Method | Endpoint | 설명 | 인증 | Rate Limit |
|--------|----------|------|------|------------|
| POST | `/api/auth/login` | 사번+비밀번호 → JWT 발급 | X | 5회/분 |
| POST | `/api/auth/refresh` | Refresh Token → 새 Access Token | X | 10회/분 |
| POST | `/api/auth/logout` | 토큰 무효화 | O | - |
| GET | `/api/auth/me` | 현재 사용자 정보 | O | - |

### 7.3 태스크 API

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/api/tasks/graph` | 그래프 렌더링용 경량 Flat List | O |
| GET | `/api/tasks/{id}` | 태스크 상세 정보 | O |
| POST | `/api/tasks` | 태스크 생성 (레벨 자동 결정) | O |
| PUT | `/api/tasks/{id}` | 태스크 수정 (이력 스냅샷 자동 생성) | O |
| DELETE | `/api/tasks/{id}` | Soft Delete (자식 있으면 거부) | O |
| GET | `/api/tasks/{id}/history` | 변경 이력 조회 | O |

**GET /api/tasks/graph 쿼리 파라미터**:
- `organization`: 조직 필터
- `level`: 레벨 필터
- `is_ai_utilized`: AI 활용 여부 필터

### 7.4 업로드 API

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/api/upload` | 엑셀 파일 업로드 | O |

업로드 API는 내부적으로 preview → diff → confirm 3단계 처리.

### 7.5 헬스체크

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 서버 상태 확인 |

---

## 8. 핵심 기술 구현 사항

### 8.1 하이브리드 그래프 레이아웃

**파일**: `frontend/src/utils/layout.ts`

- Root → L1 → L2: **방사형 레이아웃** (Root 중심으로 원형 배치)
- L2 → L3 → L4: **계층형 레이아웃** (Dagre 알고리즘 기반 트리)

| 레벨 | 배치 방식 | 거리 |
|------|----------|------|
| L1 | Root 중심 원형 | 반경 400px |
| L2 | Root 중심 원형 | 반경 800px |
| L3 | 부모 L2 외측 | 240px |
| L4 | 부모 L3 외측 | 220px (>4개 시 2열 그리드) |

### 8.2 Axios 인터셉터 (JWT 자동 갱신)

**파일**: `frontend/src/api/client.ts`

1. **Request Interceptor**: `authStore.accessToken`을 `Authorization: Bearer` 헤더에 자동 주입
2. **Response Interceptor**: 401 응답 시 refresh token으로 새 access token 발급 시도 → 실패 시 로그아웃

### 8.3 PgBouncer 호환 DB 연결

**파일**: `backend/app/db/session.py`

- `statement_cache_size=0`: Prepared Statement 캐싱 비활성화
- `NullPool`: SQLAlchemy 자체 풀링 비활성화 → PgBouncer에 위임

### 8.4 Task 수정 트랜잭션

**파일**: `backend/app/services/task_service.py`

Task 수정 시 단일 트랜잭션으로 처리:
1. 현재 상태를 JSONB 스냅샷으로 `task_histories`에 저장
2. `tasks` 테이블 업데이트 (version +1)
3. 커밋

---

## 9. 공유 컴포넌트

**디렉토리**: `frontend/src/components/shared/`

| 컴포넌트 | 파일 | Props |
|---------|------|-------|
| `Button` | `Button.tsx` | variant(primary/secondary/danger/ghost), size(sm/md/lg), icon, loading |
| `Input` | `Input.tsx` | icon, 표준 input props |
| `Modal` | `Modal.tsx` | isOpen, onClose, title, children |
| `ConfirmModal` | `ConfirmModal.tsx` | title, message, onConfirm, onCancel |
| `Badge` | `Badge.tsx` | variant(default/primary/success/warning/danger/ai), size(sm/md) |

---

## 10. 개발 환경 설정

### 10.1 로컬 실행

```bash
# Docker Compose (전체)
docker-compose up -d
# PostgreSQL: localhost:5432
# Backend: localhost:8000
# Frontend: localhost:5173

# 또는 수동 실행
cd backend && python -m uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

### 10.2 테스트 계정

| 사번 | 비밀번호 | 권한 |
|------|---------|------|
| admin | admin123 | admin |

### 10.3 빌드

```bash
cd frontend
npm run build    # tsc -b && vite build → dist/
```

### 10.4 주요 의존성

**Frontend** (`frontend/package.json`):

| 패키지 | 버전 | 용도 |
|--------|------|------|
| react | ^19.2.0 | UI 라이브러리 |
| react-router-dom | ^7.13.0 | 라우팅 |
| reactflow | ^11.11.4 | 그래프 시각화 |
| zustand | ^5.0.10 | 상태 관리 |
| @tanstack/react-query | ^5.90.20 | 서버 상태 캐싱 |
| axios | ^1.13.4 | HTTP 클라이언트 |
| tailwindcss | ^4.1.18 | CSS 프레임워크 |
| lucide-react | ^0.563.0 | 아이콘 |
| dagre | ^0.8.5 | 그래프 레이아웃 알고리즘 |
| d3-force | ^3.0.0 | 물리 시뮬레이션 레이아웃 |

**Backend** (Python):

| 패키지 | 용도 |
|--------|------|
| fastapi | 웹 프레임워크 |
| uvicorn | ASGI 서버 |
| sqlalchemy[asyncio] | ORM (Async) |
| asyncpg | PostgreSQL 드라이버 |
| pydantic-settings | 환경설정 |
| python-jose[cryptography] | JWT |
| passlib[bcrypt] | 비밀번호 해싱 |

---

## 11. 배포 구성

| 서비스 | 플랫폼 | 설정 파일 |
|--------|--------|----------|
| Frontend | Cloudflare Pages | `vite.config.ts` (빌드 출력 dist/) |
| Backend | Render | `render.yaml`, `Dockerfile.render` |
| Database | Supabase | PostgreSQL 15 + PgBouncer |

---

## 12. 커밋 히스토리 (개발 진행 이력)

| 커밋 | 날짜 | 설명 |
|------|------|------|
| `6df6940` | 2026-02-02 | 최초 커밋: 전체 시스템 초기 구축 (FE + BE + Infra) |
| `8757d2e` | 2026-02-02 | TypeScript 빌드 에러 수정 |
| `91bc229` | 2026-02-03 | .gitignore에 DB 파일 제외 |
| `3e8ba0c` | 2026-02-03 | 계층형 레이아웃 + 401 에러 처리 |
| `8f53c17` | 2026-02-04 | PgBouncer 호환성 1차 시도 |
| `60e554d` | 2026-02-04 | PgBouncer 호환성 2차 시도 (URL 파라미터) |
| `7882c3c` | 2026-02-04 | PgBouncer 호환성 최종 해결 (connect_args + NullPool) |
| `be6ab57` | 2026-02-04 | 방사형(Radial) 레이아웃으로 개선 |
| `b6015fa` | 2026-03-03 | 하이브리드 레이아웃 + MinDistanceEdge 커스텀 엣지 |
| `990a24d` | 2026-03-03 | ReactFlow v11 호환성 수정 (useStore 방식) |
| `4c318be` | 2026-03-03 | 엑셀 업로드 기능 + 그래프 레이아웃 개선 |
| `4f988a8` | 2026-03-03 | CLAUDE 설정 변경 |
| `c1b7864` | 2026-03-03 | DEVELOPMENT_LOG.md 생성 |
| `10c9338` | 2026-03-03 | BaseEdge TypeScript 빌드 에러 수정 (Render 배포 호환) |
| `d2e34f8` | 2026-03-03 | 미사용 변수 제거 - TypeScript 빌드 에러 해결 |

---

## 13. 현재 구현 상태 및 미구현 항목

### 구현 완료

- [x] JWT 인증 시스템 (로그인, 토큰 갱신, 로그아웃)
- [x] 대시보드 페이지 (KPI 통계, 레벨 분포, 퀵 액션, 최근 태스크)
- [x] 인터랙티브 그래프 시각화 (하이브리드 레이아웃)
- [x] 태스크 CRUD (생성, 수정, 삭제, 상세 조회)
- [x] 변경 이력 관리 (JSONB 스냅샷)
- [x] 조직/레벨/AI 필터링 (조상 노드 자동 유지)
- [x] 노드 확장/축소 (개별 + 전체)
- [x] 엑셀 업로드 (4단계 워크플로우: 업로드→미리보기→비교→반영)
- [x] 반응형 레이아웃 (사이드바 접기/펼치기)
- [x] Cloudflare + Render + Supabase 배포
- [x] PgBouncer 호환 DB 연결

### 미구현 / 개선 필요

- [ ] `/users` 페이지: 사용자 관리 UI (현재 DashboardPage 별칭)
- [ ] `/settings` 페이지: 설정 UI (현재 DashboardPage 별칭)
- [ ] Redis 기반 토큰 블랙리스트 (현재 인메모리)
- [ ] 노드 드래그 앤 드롭 계층 이동
- [ ] 키워드/담당자 통합 검색
- [ ] 권한별 접근 제어 세분화 (editor/viewer 역할 분리)
- [ ] 대량 데이터(3,000+ 노드) 성능 최적화 테스트
- [ ] E2E 테스트 및 단위 테스트
- [ ] CI/CD 파이프라인

---

## 14. Codex 작업 가이드

### 코드 컨벤션

- **코드 간결성 최우선**: 최대한 짧고 간결하게 작성
- **TypeScript strict mode**: 타입 안정성 보장
- **컴포넌트 패턴**: 함수형 컴포넌트 + `memo` (성능 민감 컴포넌트)
- **상태 관리**: Zustand 스토어 사용 (React Query는 staleTime 5분 설정)
- **스타일링**: Tailwind CSS 유틸리티 클래스 (clsx + tailwind-merge 조합)
- **아이콘**: lucide-react 사용
- **알림**: react-hot-toast 사용

### 파일 수정 시 참고

- **새 페이지 추가**: `frontend/src/pages/`에 생성 → `App.tsx`에 라우트 등록
- **새 API 추가**: `backend/app/api/`에 라우터 생성 → `main.py`에 등록
- **새 컴포넌트 추가**: 용도에 따라 `graph/`, `layout/`, `shared/` 하위에 배치
- **타입 추가**: `frontend/src/types/task.ts`에 인터페이스 정의
- **스토어 수정**: `frontend/src/stores/`의 해당 스토어 파일 수정

### 주의사항

- ReactFlow는 **v11** 사용 중 (v12 API 사용 불가, `useInternalNode` 등)
- DB 연결은 **NullPool** 사용 (PgBouncer 호환)
- 태스크 삭제는 **Soft Delete** (deleted_at 필드 사용)
- 태스크 수정 시 반드시 **이력 스냅샷** 생성 필요
- 필터링 시 **조상 노드 체인** 자동 유지 로직 필수
