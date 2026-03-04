# PI Management System - 개발 진행 내역

> **프로젝트**: PI 내역 자산화 및 Tracking 관리 시스템
> **목표**: 본사 업무를 L1~L4 단계로 계층화하여 시각적으로 추적 관리하고, 변경 이력을 자산화하는 웹 시스템
> **최종 업데이트**: 2026-03-03

---

## 1. 프로젝트 개요

### 시스템 아키텍처

| 계층 | 기술 스택 | 비고 |
|------|----------|------|
| **Frontend** | React 19 + TypeScript + Vite | ReactFlow v11, Zustand, TanStack Query, Tailwind CSS |
| **Backend** | FastAPI + SQLAlchemy 2.0 (Async) | Pydantic v2, JWT 인증, Rate Limiting |
| **Database** | PostgreSQL 15 | asyncpg 드라이버, PgBouncer 호환 |
| **인프라** | Docker Compose | Cloudflare Pages + Supabase + Render 배포 지원 |

### 주요 기능

- 계층적 업무 관리 (Root → L1 → L2 → L3 → L4)
- ReactFlow 기반 인터랙티브 그래프 시각화
- 변경 이력 스냅샷 저장 (Audit Log)
- 조직/레벨/AI활용 여부 필터링
- JWT 기반 인증/인가 (Access + Refresh Token)

---

## 2. 커밋 히스토리 및 개발 단계

### Phase 1: 초기 구축 (2026-02-02)

#### `6df6940` - Initial commit: PI Management System

프로젝트 전체 초기 구조 구축 완료.

**Backend 구현:**
- FastAPI 앱 초기화 (`main.py`) - CORS, 미들웨어, 라우터 등록
- SQLAlchemy 2.0 Async ORM 모델 정의
  - `User` 모델: UUID PK, employee_id, role (admin/editor/viewer), 비밀번호 해싱
  - `Task` 모델: UUID PK, parent_id (자기참조 FK), level, keywords(배열), soft delete
  - `TaskHistory` 모델: JSONB 스냅샷, 변경 유형(CREATE/UPDATE/DELETE)
- Pydantic v2 스키마: `TaskCreate`, `TaskUpdate`, `TaskDetail`, `TaskGraphItem`, `ApiResponse`
- JWT 인증 시스템: Access Token(15분) + Refresh Token(7일), 토큰 블랙리스트
- API 엔드포인트 구현:
  - `POST /api/auth/login` - 로그인
  - `POST /api/auth/refresh` - 토큰 갱신
  - `POST /api/auth/logout` - 로그아웃
  - `GET /api/auth/me` - 현재 사용자 조회
  - `GET /api/tasks/graph` - 그래프 데이터 조회 (필터링 지원)
  - `GET /api/tasks/{id}` - 태스크 상세 조회
  - `POST /api/tasks` - 태스크 생성
  - `PUT /api/tasks/{id}` - 태스크 수정
  - `DELETE /api/tasks/{id}` - 태스크 삭제 (soft delete)
  - `GET /api/tasks/{id}/history` - 변경 이력 조회
- Rate Limiting: 로그인 5회/분, 토큰 갱신 10회/분
- DB 시드 스크립트: 샘플 계층 데이터 포함

**Frontend 구현:**
- React + TypeScript + Vite 프로젝트 설정
- 페이지 구성: `LoginPage`, `DashboardPage`, `GraphPage`
- 그래프 컴포넌트: `TaskGraph`, `TaskNode`, `DetailSidebar`, `FilterBar`
- 모달: `TaskFormModal`, `HistoryModal`, `ConfirmModal`
- Zustand 상태 관리: `authStore`, `taskStore`, `modalStore`
- API 클라이언트: Axios 기반, interceptor를 통한 JWT 자동 갱신
- Tailwind CSS 기반 UI 디자인
- ProtectedRoute 컴포넌트 (인증 가드)

**인프라:**
- `docker-compose.yml`: PostgreSQL + Backend + Frontend 오케스트레이션
- `DEPLOYMENT.md`: Cloudflare Pages + Supabase 배포 가이드
- `render.yaml`: Render 플랫폼 IaC 설정
- `Dockerfile.render`: 프로덕션 빌드 설정

---

#### `8757d2e` - Fix TypeScript build errors (2026-02-02)

- TypeScript 컴파일 오류 수정
- 타입 정의 불일치 해결

---

### Phase 2: 데이터베이스 및 인프라 안정화 (2026-02-03 ~ 02-04)

#### `91bc229` - database 제외 (2026-02-03)

- `.gitignore`에 데이터베이스 관련 파일 제외 규칙 추가
- 로컬 DB 볼륨 데이터가 버전 관리에 포함되지 않도록 설정

---

#### `3e8ba0c` - feat: 계층형 레이아웃 및 401 에러 처리 추가 (2026-02-03)

- **그래프 레이아웃**: 계층형 트리 레이아웃 알고리즘 구현
  - 노드 간 적절한 간격 및 정렬 처리
- **401 에러 처리**: API 호출 시 인증 만료 대응
  - 자동 로그아웃 및 로그인 페이지 리다이렉트

---

#### `8f53c17` - fix: PgBouncer 호환성을 위해 prepared statements 비활성화 (2026-02-04)

- Supabase PgBouncer 환경에서 prepared statement 관련 오류 해결
- asyncpg 드라이버의 statement caching 비활성화 시도 (첫 번째 접근)

---

#### `60e554d` - fix: PgBouncer 호환성 - URL 파라미터 방식으로 변경 (2026-02-04)

- PgBouncer 호환성 문제를 URL 파라미터 방식으로 변경하여 재시도
- 데이터베이스 연결 URL에 직접 옵션 추가

---

#### `7882c3c` - fix: connect_args 방식으로 prepared statement 캐시 비활성화 (2026-02-04)

- 최종 해결: `connect_args` 방식을 사용하여 prepared statement 캐시 완전 비활성화
- `NullPool` 전략 적용 → PgBouncer에 커넥션 풀링 위임
- Supabase 운영 환경에서 안정적 DB 연결 확보

---

#### `be6ab57` - feat: 방사형 레이아웃 개선 - 연결선 꼬임 방지 (2026-02-04)

- 기존 계층형 레이아웃을 **방사형(Radial) 레이아웃**으로 개선
- Root 노드를 중심으로 L1 → L2가 원형으로 확산 배치
- 노드 간 연결선(Edge)이 겹치거나 꼬이는 현상 해결

---

### Phase 3: 시각화 고도화 (2026-03-03)

#### `b6015fa` - feat: 하이브리드 레이아웃 - L3/L4 계층형 표시 및 최소 거리 연결선 (2026-03-03)

- **하이브리드 레이아웃 알고리즘** 도입:
  - Root → L1 → L2: 방사형(Radial) 레이아웃 유지
  - L2 → L3 → L4: 계층형(Hierarchical) 트리 레이아웃으로 전환
- **MinDistanceEdge** 커스텀 엣지 컴포넌트 구현:
  - 노드 간 최소 거리 기반 연결선 렌더링
  - 곡선 경로 최적화로 연결선 가독성 향상
- 레벨별 색상 체계 적용:
  - Root: `#8E72EE` (보라색)
  - L1: `#00D7D2` (청록색)
  - L2: `#191927` (다크)
  - L3: `#7259D9` (보라색)
  - L4: `#E4E3EC` (라이트)

---

#### `990a24d` - fix: ReactFlow v11 호환 - useInternalNode를 useStore로 대체 (2026-03-03)

- ReactFlow v11 API 호환성 문제 해결
- v12 전용 `useInternalNode` 훅 → v11 호환 `useStore` 훅으로 대체
- MinDistanceEdge 컴포넌트의 노드 위치 조회 방식 수정

---

## 3. 현재 프로젝트 구조

```
pi-management/
├── backend/
│   └── app/
│       ├── main.py                 # FastAPI 앱 진입점
│       ├── core/
│       │   ├── config.py           # 환경 설정
│       │   ├── security.py         # JWT, 비밀번호 해싱
│       │   └── rate_limit.py       # Rate Limiting
│       ├── models/
│       │   ├── user.py             # User ORM 모델
│       │   └── task.py             # Task, TaskHistory ORM 모델
│       ├── schemas/
│       │   ├── task.py             # Task Pydantic 스키마
│       │   ├── user.py             # User Pydantic 스키마
│       │   └── common.py           # ApiResponse 공통 스키마
│       ├── api/
│       │   ├── auth.py             # 인증 API 라우터
│       │   ├── tasks.py            # Task CRUD API 라우터
│       │   └── deps.py             # 의존성 주입
│       ├── services/
│       │   └── task_service.py     # 비즈니스 로직
│       └── db/
│           ├── session.py          # DB 세션 설정
│           └── seed.py             # 시드 데이터
├── frontend/
│   └── src/
│       ├── pages/                  # LoginPage, DashboardPage, GraphPage
│       ├── components/
│       │   ├── layout/             # MainLayout, Header, Sidebar
│       │   ├── graph/              # TaskGraph, TaskNode, MinDistanceEdge, ...
│       │   └── shared/             # Button, Input, Modal, Badge
│       ├── stores/                 # authStore, taskStore, modalStore
│       ├── api/                    # HTTP 클라이언트, API 함수
│       ├── types/                  # TypeScript 타입 정의
│       └── utils/                  # 레이아웃 유틸리티
├── docker-compose.yml
├── DEPLOYMENT.md
├── guide_v4.md                     # PRD 문서
├── render.yaml
└── Dockerfile.render
```

---

## 4. 데이터베이스 스키마

### users 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 고유 식별자 |
| employee_id | VARCHAR (UNIQUE) | 사번 |
| password_hash | VARCHAR | bcrypt 해시 |
| name | VARCHAR | 이름 |
| organization | VARCHAR | 소속 조직 |
| role | VARCHAR | admin / editor / viewer |
| is_active | BOOLEAN | 활성 상태 |
| created_at | TIMESTAMP | 생성일시 |

### tasks 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 고유 식별자 |
| parent_id | UUID (FK, nullable) | 상위 태스크 |
| level | VARCHAR | Root / L1 / L2 / L3 / L4 |
| name | VARCHAR(200) | 태스크명 |
| organization | VARCHAR(100) | 담당 조직 |
| team | VARCHAR | 팀 |
| manager_name | VARCHAR | 담당자명 |
| manager_id | VARCHAR | 담당자 사번 |
| keywords | ARRAY[VARCHAR] | 키워드 목록 |
| is_ai_utilized | BOOLEAN | AI 활용 여부 |
| version | INTEGER | 낙관적 잠금 |
| created_by / updated_by | UUID (FK) | 작성/수정자 |
| created_at / updated_at | TIMESTAMP(TZ) | 생성/수정일시 |
| deleted_at | TIMESTAMP (nullable) | Soft Delete |

### task_history 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 고유 식별자 |
| task_id | UUID (FK) | 대상 태스크 |
| snapshot | JSONB | 변경 시점 전체 스냅샷 |
| version | INTEGER | 버전 번호 |
| change_type | VARCHAR | CREATE / UPDATE / DELETE |
| changed_by | UUID (FK) | 변경자 |
| changed_at | TIMESTAMP | 변경일시 |

---

## 5. API 엔드포인트 목록

### 인증 API (`/api/auth`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/auth/login` | 로그인 (JWT 발급) | X |
| POST | `/auth/refresh` | 토큰 갱신 | X |
| POST | `/auth/logout` | 로그아웃 (토큰 무효화) | O |
| GET | `/auth/me` | 현재 사용자 정보 | O |

### Task API (`/api/tasks`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/tasks/graph` | 그래프 데이터 조회 (필터 지원) | O |
| GET | `/tasks/{id}` | 태스크 상세 조회 | O |
| POST | `/tasks` | 태스크 생성 | O |
| PUT | `/tasks/{id}` | 태스크 수정 | O |
| DELETE | `/tasks/{id}` | 태스크 삭제 (soft delete) | O |
| GET | `/tasks/{id}/history` | 변경 이력 조회 | O |

### 헬스체크

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/health` | 서버 상태 확인 |

---

## 6. 주요 기술적 의사결정 및 해결 과정

### PgBouncer 호환성 이슈 (3회 시도 끝에 해결)

| 시도 | 커밋 | 접근 방식 | 결과 |
|------|------|----------|------|
| 1차 | `8f53c17` | asyncpg statement caching 비활성화 | 부분 해결 |
| 2차 | `60e554d` | URL 파라미터 방식 | 불완전 |
| 3차 | `7882c3c` | `connect_args` + `NullPool` 전략 | **최종 해결** |

**근본 원인**: Supabase의 PgBouncer가 transaction 모드로 동작하여 asyncpg의 prepared statement와 충돌
**최종 해결**: `connect_args`로 `statement_cache_size=0` 설정 + SQLAlchemy `NullPool` 사용

### 그래프 레이아웃 진화

| 단계 | 커밋 | 레이아웃 | 개선 사항 |
|------|------|----------|----------|
| 1단계 | `3e8ba0c` | 계층형 (Hierarchical) | 기본 트리 구조 표시 |
| 2단계 | `be6ab57` | 방사형 (Radial) | 연결선 꼬임 방지, 공간 효율 개선 |
| 3단계 | `b6015fa` | 하이브리드 (Hybrid) | L1-L2 방사형 + L3-L4 계층형 조합 |

### ReactFlow 버전 호환성

- `990a24d`: ReactFlow v11에서 v12 전용 API(`useInternalNode`) 사용으로 인한 오류
- `useStore` 훅을 통해 내부 노드 상태 접근하는 방식으로 해결

---

## 7. 개발 환경 설정

### Docker Compose 실행

```bash
docker-compose up -d
# PostgreSQL: localhost:5432
# Backend:    localhost:8000
# Frontend:   localhost:5173
```

### 수동 실행

```bash
# Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### 테스트 계정

- **사번**: `admin`
- **비밀번호**: `admin123`

---

## 8. 배포 구성

| 서비스 | 플랫폼 | 비고 |
|--------|--------|------|
| Frontend | Cloudflare Pages | 정적 빌드 배포 |
| Backend | Railway / Render | FastAPI + Uvicorn |
| Database | Supabase | PostgreSQL + PgBouncer |

---

## 9. 향후 개발 예정 사항

PRD(`guide_v4.md`) 기준 미구현 또는 개선 필요 항목:

- [ ] Redis 기반 토큰 블랙리스트 (현재: 인메모리)
- [ ] 대시보드 페이지 상세 구현 (통계, 차트)
- [ ] 노드 드래그 앤 드롭을 통한 계층 이동
- [ ] 검색 기능 강화 (키워드, 담당자 통합 검색)
- [ ] 권한별 접근 제어 세분화 (editor/viewer 역할 분리)
- [ ] 대량 데이터(3,000+ 노드) 성능 최적화 테스트
- [ ] E2E 테스트 및 단위 테스트 작성
- [ ] CI/CD 파이프라인 구축
