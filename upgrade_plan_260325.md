# PI Management System 업그레이드 계획서 (2026-03-25)

> 각 개선 항목은 독립적인 feature 브랜치로 분리하여 개별 구현/머지 가능하도록 구성됨.
> 의존성이 있는 feature는 명시적으로 표기.

## 구현 진행 상태 (최종 업데이트: 2026-03-26)

| Feature | 이름 | 상태 | 비고 |
|---------|------|------|------|
| 1 | Docker 포트 마이그레이션 | ✅ 완료 | Stage 1 |
| 2 | pgvector 셋업 | ✅ 완료 | Stage 1 |
| 3 | Auth DB 권한 체크 | ✅ 완료 | Stage 2 |
| 4 | 다크 테마 | ✅ 완료 | Stage 2 |
| 5 | 계층형 그래프 레이아웃 | ✅ 완료 | Stage 2 |
| 6 | 그래프 노드 UX | ✅ 완료 | Stage 2 |
| 7 | 유관팀 입력 필드 | ✅ 완료 | Stage 3, `related_team` ARRAY 타입 |
| 8 | AI 자동 태깅 | ❌ 제거 | 사용자 요청으로 삭제 |
| 9 | 벡터 검색 | ⏭️ 스킵 | Feature 8 의존, 사용자 요청으로 스킵 |
| 10 | 연결 업무 (M:N) | ✅ 완료 | Stage 3, `task_relations` 테이블 |
| 11 | 업무 목록 테이블 뷰 | ✅ 완료 | Stage 5, `/tasks/list` |
| 12 | 업로드 개선 | ✅ 완료 | Stage 5, 100MB + 유관팀 파싱 |

**모든 변경 사항은 main 브랜치에 uncommitted 상태로 존재 (Docker 테스트 완료)**

### 추가 UX 개선 (post-upgrade, 2026-03-26)

| 항목 | 상태 | 설명 |
|------|------|------|
| 그래프 텍스트 검색 | ✅ 완료 | FilterBar 검색 입력 + TaskGraph 검색 필터 (이름/조직/팀/담당자/키워드, 조상 체인 유지) |
| 상세 모달 하위 추가 | ✅ 완료 | TaskFormModal view 모드에 "하위 업무 추가" 버튼 (editor/admin, L4 제외) |
| 상세 모달 삭제 | ✅ 완료 | TaskFormModal view 모드에 "삭제" 버튼 (admin only, Root 제외) |
| 업무 목록 하위 추가 | ✅ 완료 | TaskListPage 행 hover에 Plus 버튼 (editor/admin, L4 제외) |
| 업무 목록 Root 보호 | ✅ 완료 | Root 노드에 삭제 버튼 미표시 |

---

## 디자인 레퍼런스

- **URL**: https://i.pinimg.com/1200x/79/54/aa/7954aac2548b1f21cdc2d3cd5785bf57.jpg
- **스타일**: 다크 테마 대시보드 (블랙/다크그레이 배경, 화이트 텍스트, 퍼플 악센트)
- **카드**: 다크 그레이 라운드 카드, KPI 원형 아이콘 + 큰 숫자
- **네비게이션**: 상단 탭 바, 볼드 타이포그래피, 깔끔한 산세리프

---

## 기본 데이터 구조 (엑셀 업로드 기준)

> 아래는 실제 운영 데이터의 엑셀 컬럼 구조. 업로드 파싱 및 DB 모델의 기준이 됨.

### 엑셀 컬럼 매핑

| 컬럼 | 헤더명 | DB 필드 | 비고 |
|------|--------|---------|------|
| B | L1 | `tasks.name` (level=L1) | 조직 본부명 (예: 유선사업본부) |
| C | L2 | `tasks.name` (level=L2) | 전략/기능 그룹 (예: 통합 마케팅전략 수립) |
| D | L3 | `tasks.name` (level=L3) | 세부 업무 영역 (예: 유선사업전략 수립/ 실행) |
| E | L3 유관팀 | `tasks.related_team` (level=L3) | L3의 유관팀 (예: AI보드, Infra운용팀). 대부분 비어있음 |
| F | L4 | `tasks.name` (level=L4) | 상세 업무 (예: (분석) 시장, 경쟁 Trend 및 고객 Data 기반 전략 방향성 수립) |
| G | L4 유관팀 | `tasks.related_team` (level=L4) | L4의 유관팀. 선택적 입력 |

### 데이터 예시

```
L1: 유선사업본부
  └─ L2: 통합 마케팅전략 수립
       ├─ L3: 유선사업전략 수립/ 실행          [유관팀: AI보드, Infra운용팀]
       │    ├─ L4: (분석) 시장, 경쟁 Trend 및 고객 Data 기반 전략 방향성 수립
       │    ├─ L4: (마케팅 Plan 수립) Data와 활용 가능한 Asset 중심으로 한 마케팅 Plan 수립
       │    ├─ L4: (기대 수익성 분석) 투어 Resource와 기대 수익에 대한 Economics 분석
       │    └─ L4: (성과 측정) 가입자 확보, 매출, 순익 등 성과 분석 진행
       ├─ L3: 가입자 / 재무 목표 설정
       │    ├─ L4: (분석) 국내 가구 증감 Data와 시장 경쟁 강도 분석 기반 Total Available Market 규모 파악
       │    ├─ L4: (Target 설정) 연간 가입자 Target 설정
       │    ├─ L4: (매출, 손익) 가입자 Target 기반 매출, 순익목표 설정
       │    └─ L4: (성과 측정) Key Index 지표 관리를 통한 성과 분석  ← [AI 활용]
       ├─ L3: 신규 상품 / 요금제 기획 / 출시
       │    ├─ L4: (분석) 고객 Needs와 경쟁사 동향 분석               ← [AI 활용]
       │    ├─ L4: (기획) 인터넷, 유료방송, 부가서비스 등 상품 및 요금제 기획
       │    ├─ L4: (손익 분석) 신규 상품 및 요금제에 대한 기대 매출과 손익 분석
       │    ├─ L4: (약관) 상품 약관 반영을 위한 대외기관 Comm. 추진 및 약관 반영
       │    └─ L4: (상품 운영) 상품 출시 및 판매 현황 분석
       └─ L3: 브랜드 전략 수립
            ├─ L4: (대상 선정) 광고 / 캠페인 추진을 위한 대상 상품, 서비스 선정
            └─ L4: (Key Message) 상품 / 서비스 특징에 대한 고객 소구를 위한 Key Message, Visual 개발  ← [AI 활용]
```

### AI 활용 업무 표기
- 엑셀에서 **셀 배경색 하이라이트** (초록/노랑)로 AI 활용 업무를 표시
- 업로드 파서에서 셀 배경색 감지 → `is_ai_utilized = true` 자동 매핑 검토
- 또는 별도 컬럼(H열 등)으로 AI 여부 명시적 입력

### 업로드 파서 반영 사항 (Feature 12)
- 현재 파서: L1~L4 4개 컬럼만 파싱
- **변경 필요**: L3 유관팀(E열), L4 유관팀(G열) 2개 컬럼 추가 파싱
- `upload_service.py`의 헤더 감지 로직에 "유관팀" 컬럼 매핑 추가
- 파싱된 `related_team` 값을 Task 생성 시 함께 저장

---

## 의존성 그래프

```
Feature 1 (포트) ─→ Feature 2 (pgvector) ─→ Feature 9 (벡터검색)
                                                ↑
Feature 8 (자동태깅) ──────────────────────────┘  (OpenAI 설정 공유)

Feature 3~7, 10~12 는 모두 독립 구현 가능
```

---

## Feature 1: `infra/docker-port-migration`

> Docker 전체 포트에 +10000 적용

### 변경 내용

| 서비스 | 기존 포트 | 변경 포트 |
|--------|----------|----------|
| PostgreSQL | 5432 | **15432** |
| Backend | 8000 | **18000** |
| Frontend | 5173 | **15173** |

### 수정 파일

**`docker-compose.yml`**
- PostgreSQL: `"5432:5432"` → `"15432:5432"`
- Backend: `"8000:8000"` → `"18000:8000"`
- Frontend: `"5173:5173"` → `"15173:5173"`
- `CORS_ORIGINS_STR` 환경변수: `localhost:5173` → `localhost:15173`

**`frontend/vite.config.ts`**
- API 프록시 타겟: `http://backend:8000` → `http://backend:18000` (docker 내부는 유지, 외부 접속용만 변경)
- dev server port: `5173` → `15173`

**`backend/app/core/config.py`**
- 기본 CORS_ORIGINS 개발 포트를 15173으로 변경

### 검증
- `docker-compose up -d` 후 `localhost:15173`, `localhost:18000/health`, `localhost:15432` 접속 확인

---

## Feature 2: `infra/pgvector-setup`

> PostgreSQL에 pgvector 확장 추가 (벡터 서치용 인덱스 최적화)

**의존**: Feature 1

### 수정 파일

**`docker-compose.yml`**
- 이미지: `postgres:15-alpine` → `pgvector/pgvector:pg15`

**`backend/app/db/session.py`**
- 앱 시작 시 `CREATE EXTENSION IF NOT EXISTS vector` 실행
- pgvector 인덱스 최적화 설정 (IVFFlat, lists=100)

**`requirements.txt` (또는 pyproject.toml)**
- `pgvector>=0.2.0` 패키지 추가

### 검증
- `docker-compose up -d` 후 DB 접속
- `SELECT * FROM pg_extension WHERE extname = 'vector'` 결과 확인

---

## Feature 3: `feature/auth-db-permission`

> JWT 토큰 내 role 캐싱 → 매 요청마다 DB에서 실시간 role 조회로 전환

**독립**: 인프라 의존 없음

### 현재 상태
- `deps.py`의 `get_current_user`가 JWT payload에서 role/name/organization 추출
- Admin이 role 변경해도 기존 토큰 만료(15분)까지 반영 안 됨

### 변경 내용
- JWT payload: `{sub, role, name, ...}` → `{sub}` 만 저장
- `get_current_user`: JWT에서 `sub`(user_id)만 추출 → DB에서 `SELECT * FROM users WHERE id = :user_id` 조회
- role 변경 즉시 다음 API 요청부터 반영
- `is_active=false`인 경우 403 반환

### 수정 파일

**`backend/app/api/deps.py`**
```python
async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    # JWT에서 sub만 추출
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    # DB에서 실시간 조회
    user = await db.get(UserModel, user_id)
    if not user or not user.is_active:
        raise HTTPException(403, "비활성 계정입니다")
    return user
```

**`backend/app/core/security.py`**
- `create_access_token`: payload에서 role, name 등 제거, `sub`만 유지
- `create_refresh_token`: 동일하게 간소화

**`backend/app/api/auth.py`**
- login 응답: JWT 생성 시 `{"sub": str(user.id)}` 만 전달

### 검증
- admin 계정으로 특정 사용자 role 변경 → 해당 사용자의 다음 API 요청에서 즉시 새 role 적용 확인
- is_active=false 설정 → 즉시 403 반환 확인

---

## Feature 4: `feature/ui-dark-theme`

> 전체 UI를 다크 테마로 전환 + 인풋 스타일 개선 + 로그인 간결화

**독립**

### 디자인 컬러 팔레트

| 용도 | 컬러 | HEX |
|------|------|-----|
| 배경 (메인) | 거의 블랙 | `#0D0D12` |
| 배경 (카드) | 다크 그레이 | `#1A1A24` |
| 배경 (사이드바) | 딥 다크 | `#111118` |
| 보더 | 미묘한 그레이 | `#2A2A35` |
| 텍스트 (주) | 화이트 | `#FFFFFF` |
| 텍스트 (보조) | 라이트 그레이 | `#9CA3AF` |
| 악센트 (퍼플) | 바이올렛 | `#7952B3` |
| 악센트 (호버) | 라이트 퍼플 | `#9B7ACC` |
| 성공 | 그린 | `#22C55E` |
| 경고 | 옐로 | `#EAB308` |
| 위험 | 레드 | `#EF4444` |
| 인풋 배경 | 다크 | `#1E1E2A` |
| 인풋 포커스 보더 | 화이트 | `#FFFFFF` |

### 인풋 스타일 변경

**현재**: `focus:ring-2 focus:ring-[#7952B3] focus:border-transparent` (퍼플 링 + 블러)
**변경**: `focus:outline-none focus:ring-0 focus:border-white focus:border-2` (화이트 테두리, 링/블러 없음)

### 로그인 페이지 간결화

**제거 항목**:
- 좌측 패널 전체 카피라이팅 텍스트 ("전사 업무 프로세스 / 통합 관리 시스템" 등)
- 통계 그리드 ("1,000+ 업무 노드", "10 조직 단위" 등)
- 하단 저작권 텍스트

**유지 항목**:
- "PI" 로고 아이콘 + **"SKB PI Management System"** 텍스트만
- 로그인 폼 (사번, 비밀번호, 로그인 버튼)
- 회원가입 링크

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/index.css` | CSS 변수 다크 테마로 전환, 스크롤바 다크 |
| `frontend/src/components/shared/Input.tsx` | 다크 배경 + 화이트 포커스 보더 |
| `frontend/src/components/shared/Button.tsx` | 다크 테마 variant 색상 |
| `frontend/src/components/shared/Modal.tsx` | 다크 배경 모달 |
| `frontend/src/components/shared/Badge.tsx` | 다크 테마 배지 색상 |
| `frontend/src/pages/LoginPage.tsx` | 카피라이팅 제거, 다크 테마 |
| `frontend/src/pages/SignUpPage.tsx` | 동일 다크 테마 적용 |
| `frontend/src/pages/DashboardPage.tsx` | 다크 KPI 카드, 차트 색상 |
| `frontend/src/pages/GraphPage.tsx` | 다크 배경 |
| `frontend/src/pages/UploadPage.tsx` | 다크 테마 업로드 영역 |
| `frontend/src/components/layout/MainLayout.tsx` | 다크 배경 컨테이너 |
| `frontend/src/components/layout/Sidebar.tsx` | 다크 사이드바 (기존 #191927 유사) |
| `frontend/src/components/layout/Header.tsx` | 다크 헤더 |
| `frontend/src/components/graph/FilterBar.tsx` | 다크 테마 필터 |
| `frontend/src/components/graph/DetailSidebar.tsx` | 다크 상세 패널 |
| `frontend/src/components/graph/TaskFormModal.tsx` | 다크 모달 + select 스타일 |
| `frontend/src/components/graph/ContextMenu.tsx` | 다크 컨텍스트 메뉴 |
| `frontend/src/admin/pages/*.tsx` | Admin 페이지 전체 다크 테마 |

### 검증
- `npm run build` 성공
- 모든 페이지 시각 확인 (로그인, 대시보드, 그래프, 업로드, Admin)
- 인풋 포커스 시 화이트 테두리만 표시 (링/블러 없음)

---

## Feature 5: `feature/graph-layout-hierarchical`

> 그래프 레이아웃: L1만 방사형(Radial), L2~L4는 모두 계층형(Hierarchical)으로 변경

**독립**

### 현재 상태
- Root → L1 → L2: 방사형 (400px, 800px 반경)
- L2 → L3 → L4: 계층형

### 변경 후
- Root → L1: 방사형 (400px 반경) ← 유지
- L1 → L2 → L3 → L4: **모두 계층형** (각 부모에서 외측 배치)

### 레이아웃 상수

| 레벨 | 부모로부터 거리 | 배치 방식 |
|------|---------------|----------|
| L1 | Root 중심 400px | 방사형 (원형) |
| L2 | L1에서 300px 외측 | 계층형 |
| L3 | L2에서 240px 외측 | 계층형 |
| L4 | L3에서 220px 외측 | 계층형 (4개 초과 시 2열) |

### 수정 파일

**`frontend/src/utils/layout.ts`**
- `LEVEL_RADIUS`에서 L2 항목 제거 (L2는 더 이상 방사형이 아님)
- `positionSubtree` 함수: L1 자식 노드 처리 시 방사형 대신 `positionHierarchicalSubtree` 호출
- `positionL3L4Subtree` → `positionHierarchicalSubtree`로 일반화 (L2/L3/L4 재귀 처리)
- 새 상수: `TREE_L2_DEPTH = 300`

**`frontend/src/components/graph/TaskGraph.tsx`**
- 레이아웃 함수 호출 부분 업데이트 (변경된 API 반영)

### 검증
- 그래프 페이지에서 전체 노드 렌더링 확인
- L1: Root 중심 원형 배치
- L2: L1에서 외측 방향 계층형 배치
- L3/L4: 기존과 동일한 계층형 배치
- 전체 확장/축소 정상 동작

---

## Feature 6: `feature/graph-node-ux`

> 노드 UX 개선: 페이드아웃 제거, 카운트 표시, 더블클릭 상세, Root 고정

**독립**

### 6-1. 노드 선택 시 페이드아웃 제거

**현재**: 선택 시 관련 없는 노드에 `opacity-30 blur-[1px] scale-95` 적용
**변경**: 모든 노드 항상 100% 불투명. 선택된 노드만 `ring-2` 하이라이트

**`frontend/src/components/graph/TaskGraph.tsx`**
- `createNode`에서 `shouldBlur` 로직 제거, `isBlurred: false` 고정
- `createEdge`에서 blur 기반 opacity 로직 제거, 모든 엣지 `opacity: 1`

**`frontend/src/components/graph/TaskNode.tsx`**
- `isBlurred` 조건부 클래스 제거

### 6-2. AI업무 / 전체업무 카운트 표시

각 노드에 하위 전체 태스크 수와 AI 활용 태스크 수 표시.

**`frontend/src/components/graph/TaskGraph.tsx`**
- `createNode` 시 재귀적으로 descendants 카운트 계산:
  - `totalDescendantCount`: 전체 하위 노드 수
  - `aiDescendantCount`: `is_ai_utilized === true`인 하위 노드 수
- data prop으로 전달

**`frontend/src/components/graph/TaskNode.tsx`**
- 노드 하단에 `AI {n} / 전체 {m}` 형태로 표시
- leaf 노드(카운트 0)는 표시 안 함

### 6-3. 노드 더블클릭 → 상세 모달

**`frontend/src/components/graph/TaskGraph.tsx`**
- ReactFlow에 `onNodeDoubleClick` 핸들러 추가
- 더블클릭 시 `modalStore.open({ type: 'edit', data: { taskId: node.id } })` 호출
- 기존 TaskFormModal이 상세 보기 모드로 열림
- 모달 내 "수정하기" 버튼 클릭 시 동일 모달에서 인라인 수정 모드로 전환

### 6-4. Root 노드 "SKB" 고정

**프론트엔드**:
- `TaskFormModal.tsx`: Root 레벨일 때 name 필드 disabled, 값 "SKB" 고정
- `ContextMenu.tsx`: Root 노드에 삭제/수정 메뉴 숨김

**백엔드**:
- `backend/app/services/task_service.py`: `update_task`에서 Root 레벨 name 변경 거부
- `delete_task`는 이미 Root 삭제를 차단하고 있음 (유지)

### 검증
- 노드 클릭 시 다른 노드가 흐려지지 않는지 확인
- 각 노드에 AI/전체 카운트 표시 확인
- 노드 더블클릭 시 상세 모달 오픈 → 수정하기 → 인라인 수정 동작 확인
- Root 노드 이름 변경 시도 시 차단 확인

---

## Feature 7: `feature/node-input-enhancement`

> Node Level별 입력 정보 차등화: L3/L4만 유관팀(related_team) 필드

**독립**

### DB 변경

**`backend/app/models/task.py`**
```python
related_team = Column(String(100), nullable=True)  # L3/L4 전용 유관팀
```

### 엑셀 데이터 구조와의 매핑

> 실제 엑셀 기준: `B:L1 | C:L2 | D:L3 | E:L3유관팀 | F:L4 | G:L4유관팀`
> L3/L4 각각 별도의 유관팀 컬럼이 존재하며, L1/L2에는 유관팀 없음

### 레벨별 입력 필드 매트릭스

| 필드 | Root | L1 | L2 | L3 | L4 |
|------|------|-----|-----|-----|-----|
| 이름 | 고정(SKB) | O | O | O | O |
| 조직 | - | 자동(=이름) | O | O | O |
| 조직유형 | - | O | O | O | O |
| 팀 | - | - | O | O | O |
| 유관팀 | - | - | - | **O** (E열) | **O** (G열) |
| 담당자명 | - | - | O | O | O |
| 담당자사번 | - | - | O | O | O |
| 키워드 | - | O | O | O | O |
| AI활용 | - | - | - | - | O (셀 하이라이트 또는 별도 컬럼) |

### 유관팀 입력 규칙
- **쉼표 구분 복수 입력 가능**: 예) "AI보드, Infra운용팀" → 문자열 그대로 저장
- L1/L2 레벨에서는 유관팀 필드 자체가 비활성 (UI에서 숨김)
- 엑셀 업로드 시 E열(L3 유관팀), G열(L4 유관팀) 자동 매핑

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/models/task.py` | `related_team` 컬럼 추가 (`VARCHAR(100)`, nullable) |
| `backend/app/schemas/task.py` | TaskGraphItem, TaskDetail, TaskCreate, TaskUpdate에 `related_team` 추가 |
| `backend/app/services/task_service.py` | create/update 시 L3/L4만 `related_team` 저장, 그 외 레벨은 `None` 강제 |
| `frontend/src/types/task.ts` | `related_team: string \| null` 추가 |
| `frontend/src/components/graph/TaskFormModal.tsx` | 레벨별 조건부 필드 렌더링, L3/L4일 때만 유관팀 필드 표시 |
| `frontend/src/components/graph/DetailSidebar.tsx` | 상세 정보에 유관팀 표시 (L3/L4) |
| `frontend/src/components/graph/DetailPanel.tsx` | 유관팀 정보 행 추가 |

### 검증
- L3/L4 태스크 생성/수정 시 유관팀 필드 표시 확인
- L1/L2 태스크에서는 유관팀 필드 미표시 확인
- "AI보드, Infra운용팀" 같은 복수 유관팀 입력/저장/표시 확인
- API 응답에 related_team 포함 확인

---

## Feature 8: `feature/auto-tagging`

> OpenAI API 기반 입력 내용 자동 태깅

**의존**: OpenAI API 키 설정 필요

### 구현 내용

**새 파일: `backend/app/services/tagging_service.py`**
```python
async def auto_tag(task_name: str, organization: str, team: str | None) -> list[str]:
    """OpenAI GPT-4o-mini를 사용하여 3~5개 한국어 태그 자동 생성"""
    # 시스템 프롬프트: "주어진 업무명, 조직, 팀 정보를 바탕으로 관련 키워드 태그를 3~5개 생성하세요."
    # 3초 타임아웃, 실패 시 빈 리스트 반환
```

**새 API 엔드포인트: `POST /api/tasks/auto-tag`**
- 요청: `{ name: str, organization: str, team: str | null }`
- 응답: `{ tags: ["태그1", "태그2", "태그3"] }`
- 권한: EditorUser

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/core/config.py` | `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL` 설정 추가 |
| NEW `backend/app/services/tagging_service.py` | auto_tag 함수 |
| `backend/app/api/tasks.py` | `POST /api/tasks/auto-tag` 엔드포인트 추가 |
| `frontend/src/api/taskApi.ts` | `autoTag(name, org, team)` 함수 추가 |
| `frontend/src/components/graph/TaskFormModal.tsx` | 키워드 필드 옆 "AI 자동 태그" 버튼 추가 |

### 프론트엔드 동작
1. 태스크 생성/수정 폼에서 "AI 자동 태그" 버튼 클릭
2. 현재 입력된 name, organization, team 값으로 API 호출
3. 반환된 태그를 keywords 필드에 자동 채움
4. 사용자가 저장 전 태그 편집/삭제 가능

### 검증
- 태스크 이름 입력 후 "AI 자동 태그" 클릭 → 관련 태그 3~5개 생성 확인
- OpenAI API 키 미설정 시 graceful 에러 처리 확인
- 타임아웃(3초) 초과 시 빈 응답 확인

---

## Feature 9: `feature/vector-search`

> pgvector 기반 벡터 검색 + 텍스트 검색 통합 구현

**의존**: Feature 2 (pgvector), Feature 8 (OpenAI 설정 공유)

### DB 변경

**`backend/app/models/task.py`**
```python
from pgvector.sqlalchemy import Vector

embedding = Column(Vector(1536), nullable=True)  # text-embedding-3-small
```

**인덱스**:
```sql
CREATE INDEX ix_tasks_embedding ON tasks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 백엔드

**새 파일: `backend/app/services/embedding_service.py`**
```python
async def generate_embedding(text: str) -> list[float] | None:
    """OpenAI text-embedding-3-small로 1536차원 벡터 생성"""
    # 3초 타임아웃, 실패 시 None 반환

async def batch_generate_embeddings(texts: list[str]) -> list[list[float] | None]:
    """대량 임베딩 생성 (업로드 시 사용, 최대 2048개/호출)"""
```

**새 API 엔드포인트: `GET /api/tasks/search`**
- 쿼리 파라미터: `q` (검색어), `type` (text|vector|combined, 기본 combined), `limit` (기본 20)
- 검색 로직:
  - **text**: `ILIKE` 검색 (name, team, keywords 배열)
  - **vector**: 검색어 임베딩 생성 → `ORDER BY embedding <=> :query_embedding`
  - **combined**: text + vector 결과 병합, 가중 점수 (0.6 vector + 0.4 text), 중복 제거
- 응답: `{ results: [{ task: TaskGraphItem, score: float, match_type: str }] }`
- 권한: ActiveUser

**`backend/app/services/task_service.py` 확장**
- `create_task`: 생성 후 embedding 자동 생성 (`f"{task.name} {task.team or ''}"`)
- `update_task`: name/team 변경 시 embedding 재생성
- 업로드 confirm 후 batch embedding 생성

### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/types/task.ts` | `SearchResult` 타입 추가 |
| `frontend/src/api/taskApi.ts` | `search(query, type?, limit?)` 함수 추가 |
| `frontend/src/stores/taskStore.ts` | `searchQuery`, `searchResults` 상태 + `search()` 액션 추가 |
| `frontend/src/components/graph/FilterBar.tsx` | 검색 입력 필드 추가 (돋보기 아이콘, 300ms 디바운스) |

### 검색 UI 동작
1. FilterBar 상단에 검색 입력 필드 표시
2. 입력 시 300ms 디바운스 후 `GET /api/tasks/search?q=...` 호출
3. 결과를 드롭다운으로 표시 (태스크명, 조직, 점수)
4. 결과 클릭 시: 해당 노드 선택 → 경로 확장 → 뷰포트 센터링
5. tag별, 업무별, AI 적용별 혼합 검색 지원

### 검증
- 검색어 입력 → 관련 태스크 결과 반환 확인
- 벡터 검색: 유사 의미 검색 동작 확인 (예: "고객 서비스" → "CS 운영" 매칭)
- 텍스트 검색: 정확한 키워드 매칭 확인
- 결과 클릭 시 그래프 노드 포커스 확인

---

## Feature 10: `feature/related-tasks`

> 태스크 간 양방향 Many-to-Many 연결 업무 기능

**독립**

### DB 변경

**새 파일: `backend/app/models/task_relation.py`**
```python
class TaskRelation(Base):
    __tablename__ = "task_relations"

    id: UUID (PK)
    task_id_a: UUID FK → tasks.id  # 항상 task_id_a < task_id_b
    task_id_b: UUID FK → tasks.id
    created_by: UUID FK → users.id
    created_at: TIMESTAMPTZ

    # Unique constraint: (task_id_a, task_id_b)
    # Index: task_id_a, task_id_b
```

> 양방향 관계: `task_id_a < task_id_b`로 정규화하여 중복 방지

### 백엔드 API

| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/tasks/{id}/relations` | 연결된 태스크 목록 | ActiveUser |
| POST | `/api/tasks/{id}/relations` | 연결 추가 `{ related_task_id: UUID }` | EditorUser |
| DELETE | `/api/tasks/{id}/relations/{related_id}` | 연결 삭제 | EditorUser |

**`backend/app/services/task_service.py` 확장**
- `get_related_tasks(db, task_id)`: `task_id_a = id OR task_id_b = id` 조회, 상대 태스크 반환
- `add_relation(db, task_id_a, task_id_b, user_id)`: 정규화 저장
- `remove_relation(db, task_id_a, task_id_b)`: 삭제

### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/types/task.ts` | `TaskRelation` 타입 추가 |
| `frontend/src/api/taskApi.ts` | `getRelations`, `addRelation`, `removeRelation` 함수 추가 |
| `frontend/src/components/graph/TaskFormModal.tsx` | "연결 업무" 섹션 추가 |
| `frontend/src/components/graph/DetailSidebar.tsx` | 연결 업무 목록 표시 |

### 연결 업무 UI
- **표시**: 연결된 태스크를 태그 칩(chip) 형태로 표시
- **추가**: Autocomplete 입력 → 태스크명 검색 (디바운스) → 드롭다운 선택 → 칩 추가
- **삭제**: 칩의 X 버튼 클릭 → DELETE API 호출
- **양방향**: A→B 연결 시 B의 상세에서도 A가 표시됨

### 검증
- 태스크 A에서 태스크 B를 연결 → B의 상세에서 A가 표시 확인
- 중복 연결 시도 시 에러 처리 확인
- 연결 삭제 후 양쪽에서 모두 제거 확인

---

## Feature 11: `feature/task-list-view`

> 별도 /tasks/list 페이지에서 테이블 형태 + 행단위 인라인 편집

**독립**

### 새 페이지: `/tasks/list`

**새 파일: `frontend/src/pages/TaskListPage.tsx`**

| 기능 | 설명 |
|------|------|
| 테이블 뷰 | Level, 이름, 조직, 팀, 담당자, AI여부, 키워드, 수정일 컬럼 |
| 정렬 | 컬럼 헤더 클릭으로 오름/내림차순 정렬 |
| 인라인 편집 | 셀 클릭 → 인풋으로 전환 → Enter 저장 / Escape 취소 |
| 필터 | 상단 필터 컨트롤 (레벨, 조직, AI 활용 등) |
| 페이지네이션 | 50행/페이지, 클라이언트 사이드 |
| 권한 | viewer: 읽기만, editor: 인라인 편집, admin: 편집+삭제 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| NEW `frontend/src/pages/TaskListPage.tsx` | 테이블 뷰 페이지 |
| `frontend/src/App.tsx` | `<Route path="/tasks/list" element={<TaskListPage />} />` 추가 |
| `frontend/src/components/layout/Sidebar.tsx` | "업무 목록" 네비게이션 링크 추가 |

### 인라인 편집 동작
1. 셀 클릭 → 해당 셀이 인풋으로 변환
2. 값 수정 후 Enter → `PUT /api/tasks/{id}` 호출 → 저장
3. Escape → 원래 값 복원
4. 저장 실패 시 에러 토스트 + 원래 값 복원

### 검증
- `/tasks/list` 접속 시 전체 태스크 테이블 표시 확인
- 컬럼 정렬 동작 확인
- 셀 클릭 → 인라인 편집 → Enter 저장 확인
- viewer 계정으로 편집 불가 확인

---

## Feature 12: `feature/upload-enhancement`

> 업로드 100MB+ 지원 + 엑셀 파서 컬럼 확장 + 100명 동시접속 스케일링

**독립** (단, Feature 7의 `related_team` 컬럼이 먼저 존재해야 유관팀 파싱 저장 가능)

### 엑셀 파서 컬럼 확장

> 현재 파서: B(L1), C(L2), D(L3), F(L4) 4개 컬럼만 파싱
> **변경**: E(L3 유관팀), G(L4 유관팀) 2개 컬럼 추가 파싱

**`backend/app/services/upload_service.py`**
- 헤더 감지 로직에 "L3 유관팀", "L4 유관팀" (또는 E열/G열 위치 기반) 매핑 추가
- `ExcelRow` 데이터 클래스에 `l3_related_team`, `l4_related_team` 필드 추가
- 파싱 시 E열 → L3 태스크의 `related_team`, G열 → L4 태스크의 `related_team`으로 매핑
- Upsert 로직에서 Task 생성 시 `related_team` 함께 저장

**기대 엑셀 컬럼 구조**:
```
| B(L1) | C(L2) | D(L3) | E(L3 유관팀) | F(L4) | G(L4 유관팀) |
```

**AI 활용 여부 감지** (선택적 구현):
- 방법 1: 셀 배경색 하이라이트 감지 (openpyxl `cell.fill` 속성)
- 방법 2: H열에 "AI" 또는 "Y" 명시적 입력
- 감지된 경우 `is_ai_utilized = true` 자동 설정

### 파일 크기 확장

**`backend/app/api/upload.py`**
- `MAX_FILE_SIZE`: `10 * 1024 * 1024` → `100 * 1024 * 1024` (100MB)
- 파일 읽기 방식: `await file.read()` (전체 메모리 로드) → **청크 스트리밍** 방식으로 변경
  ```python
  # 1MB 청크 단위로 읽어 임시 파일에 저장
  async for chunk in file:
      total_size += len(chunk)
      if total_size > MAX_FILE_SIZE:
          raise HTTPException(413, "파일 크기가 100MB를 초과합니다")
      temp_file.write(chunk)
  ```

### 동시접속 스케일링 (100명)

**`backend/app/core/config.py`**
- `DB_POOL_SIZE`: 5 → **20**
- `DB_MAX_OVERFLOW`: 10 → **30**

**`backend/app/db/session.py`**
- 변경된 풀 설정 자동 반영

### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/pages/UploadPage.tsx` | 파일 크기 안내 "최대 100MB"로 변경, 미리보기에 유관팀 컬럼 표시 |
| `frontend/src/api/uploadApi.ts` | 업로드 프로그레스 콜백 지원 (XMLHttpRequest 또는 fetch ReadableStream) |
| `backend/app/schemas/upload.py` | ExcelRow, DiffNode에 `related_team` 필드 추가 |

### 업로드 프로그레스 UI
- 파일 업로드 중 프로그레스 바 표시
- 퍼센트 + 전송량 표시 (예: "45% · 23MB / 51MB")
- 업로드 취소 버튼

### 검증
- **유관팀 파싱**: E열/G열에 유관팀이 있는 엑셀 업로드 → DB에 related_team 저장 확인
- **미리보기**: 업로드 미리보기에서 유관팀 정보 표시 확인
- 100MB 엑셀 파일 업로드 성공 확인
- 업로드 중 프로그레스 바 표시 확인
- 100MB 초과 파일 → 413 에러 확인
- 동시 접속 부하 테스트 (100 concurrent connections)

---

## 구현 우선순위 및 단계별 테스트 체크포인트

> **원칙**: 각 단계 구현이 끝나면 코딩을 정지하고 Docker 환경을 기동하여
> 사용자가 직접 브라우저에서 테스트할 수 있도록 한다.
> 다음 단계는 사용자의 테스트 완료 및 승인 후에만 진행한다.

---

### 1단계: 인프라 기반 ✅ 완료

**구현 범위**:
- Feature 1: `infra/docker-port-migration` ✅
- Feature 2: `infra/pgvector-setup` ✅

**코딩 완료 후 → 테스트 체크포인트 1**

```bash
docker-compose down -v
docker-compose up -d --build
```

| 테스트 항목 | 확인 방법 | 기대 결과 |
|------------|----------|----------|
| 프론트엔드 접속 | 브라우저에서 `http://localhost:15173` | 로그인 페이지 표시 |
| 백엔드 헬스체크 | 브라우저에서 `http://localhost:18000/health` | `{"status": "ok"}` 응답 |
| DB 접속 | `psql -h localhost -p 15432 -U pi_user -d pi_management` | 접속 성공 |
| pgvector 확인 | DB에서 `SELECT extname FROM pg_extension;` | `vector` 포함 |
| 기존 기능 정상 | admin/admin123으로 로그인 → 대시보드 | 정상 표시 |

> 사용자 승인 후 2단계 진행

---

### 2단계: 핵심 변경 ✅ 완료

**구현 범위** (순차 또는 병렬):
- Feature 3: `feature/auth-db-permission` ✅
- Feature 4: `feature/ui-dark-theme` ✅
- Feature 5: `feature/graph-layout-hierarchical` ✅
- Feature 6: `feature/graph-node-ux` ✅

**코딩 완료 후 → 테스트 체크포인트 2**

```bash
docker-compose down
docker-compose up -d --build
```

| 테스트 항목 | 확인 방법 | 기대 결과 |
|------------|----------|----------|
| **권한 즉시 반영** | ① admin으로 로그인 → /admin/users에서 viewer의 role을 editor로 변경 ② viewer 계정으로 다른 브라우저에서 로그인 → 태스크 생성 시도 | 즉시 editor 권한으로 생성 가능 |
| **다크 테마** | 모든 페이지 순회 (로그인, 회원가입, 대시보드, 그래프, 업로드, Admin) | 다크 배경 + 화이트 텍스트 + 퍼플 악센트 |
| **인풋 포커스** | 로그인 폼 인풋 클릭 | 검은색(또는 화이트) 테두리만 표시, 블러/링 없음 |
| **로그인 간결화** | `/login` 접속 | "SKB PI Management System"만 표시, 카피라이팅 없음 |
| **그래프 레이아웃** | `/graph` 접속 → 전체 확장 | L1만 원형, L2~L4 계층형 배치 |
| **페이드아웃 제거** | 그래프에서 노드 클릭 | 다른 노드가 흐려지지 않고 선택 노드만 하이라이트 |
| **AI/전체 카운트** | 하위 노드가 있는 노드 확인 | "AI {n} / 전체 {m}" 표시 |
| **더블클릭 상세** | 노드 더블클릭 | 상세 모달 열림 → "수정하기" 클릭 → 인라인 수정 가능 |
| **Root 보호** | Root 노드 우클릭 또는 상세 열기 | 삭제/이름변경 불가, "SKB" 고정 |

> 사용자 승인 후 3단계 진행

---

### 3단계: 데이터 모델 확장 ✅ 완료

**구현 범위** (순차 또는 병렬):
- Feature 7: `feature/node-input-enhancement` ✅
- Feature 8: `feature/auto-tagging` ❌ 사용자 요청으로 제거
- Feature 10: `feature/related-tasks` ✅

**코딩 완료 후 → 테스트 체크포인트 3**

```bash
docker-compose down
docker-compose up -d --build
```

| 테스트 항목 | 확인 방법 | 기대 결과 |
|------------|----------|----------|
| **유관팀 필드** | L3 태스크 생성/수정 모달 열기 | "유관팀" 필드 표시 |
| **유관팀 미표시** | L1/L2 태스크 생성/수정 모달 열기 | "유관팀" 필드 없음 |
| **자동 태깅** | 태스크 수정 → "AI 자동 태그" 버튼 클릭 | 3~5개 관련 태그 자동 생성 |
| **태그 편집** | 자동 생성된 태그 삭제/수정 후 저장 | 수정된 태그로 저장됨 |
| **연결 업무 추가** | 태스크 상세 → "연결 업무" → 검색 → 선택 | 칩 형태로 추가 표시 |
| **양방향 확인** | A에서 B를 연결 → B의 상세 열기 | B에서 A가 연결 업무로 표시 |
| **연결 삭제** | 칩의 X 버튼 클릭 | 양쪽에서 모두 제거 |

> ⚠️ **자동 태깅 테스트를 위해 `.env`에 `OPENAI_API_KEY` 설정 필요**
>
> 사용자 승인 후 4단계 진행

---

### 4단계: 고급 기능 ⏭️ 스킵

**구현 범위**:
- Feature 9: `feature/vector-search` ⏭️ Feature 8 의존으로 스킵

**코딩 완료 후 → 테스트 체크포인트 4**

```bash
docker-compose down
docker-compose up -d --build
```

| 테스트 항목 | 확인 방법 | 기대 결과 |
|------------|----------|----------|
| **텍스트 검색** | FilterBar 검색창에 정확한 태스크명 입력 | 해당 태스크 결과 표시 |
| **벡터 검색** | 유사 의미 검색어 입력 (예: "고객 서비스" → "CS 운영") | 의미적으로 유사한 결과 반환 |
| **혼합 검색** | 태그 + 업무명 조합 검색 | 복합 결과 정확히 반환 |
| **결과 클릭** | 검색 결과 항목 클릭 | 그래프에서 해당 노드 선택 + 경로 확장 + 뷰포트 이동 |
| **임베딩 자동생성** | 새 태스크 생성 후 검색 | 새 태스크가 벡터 검색 결과에 포함 |

> ⚠️ **벡터 검색 테스트를 위해 기존 태스크의 임베딩 일괄 생성 필요 (최초 1회)**
>
> 사용자 승인 후 5단계 진행

---

### 5단계: 보조 기능 ✅ 완료

**구현 범위** (순차 또는 병렬):
- Feature 11: `feature/task-list-view` ✅
- Feature 12: `feature/upload-enhancement` ✅

**코딩 완료 후 → 테스트 체크포인트 5 (최종)**

```bash
docker-compose down
docker-compose up -d --build
```

| 테스트 항목 | 확인 방법 | 기대 결과 |
|------------|----------|----------|
| **태스크 목록** | 사이드바 "업무 목록" 클릭 또는 `/tasks/list` 접속 | 전체 태스크 테이블 표시 |
| **컬럼 정렬** | 컬럼 헤더 클릭 | 오름/내림차순 정렬 |
| **인라인 편집** | editor 계정 → 셀 클릭 → 값 수정 → Enter | 저장 성공, 테이블 즉시 반영 |
| **편집 취소** | 셀 수정 중 Escape | 원래 값 복원 |
| **viewer 제한** | viewer 계정 → 셀 클릭 | 편집 불가 (읽기만) |
| **대용량 업로드** | 50MB+ 엑셀 파일 업로드 | 프로그레스 바 표시 + 업로드 성공 |
| **100MB 초과** | 100MB 초과 파일 업로드 시도 | 413 에러 메시지 표시 |
| **프로그레스** | 업로드 중 UI 확인 | 퍼센트 + 전송량 표시 |

> 전체 구현 완료

---

### 테스트 공통 Docker 명령어

```bash
# 전체 재빌드 및 시작
docker-compose down -v && docker-compose up -d --build

# 로그 확인
docker-compose logs -f backend    # 백엔드 로그
docker-compose logs -f frontend   # 프론트엔드 로그
docker-compose logs -f db         # DB 로그

# 서비스 상태 확인
docker-compose ps

# DB 직접 접속
docker-compose exec db psql -U pi_user -d pi_management

# 프론트엔드 빌드 확인 (컨테이너 내부)
docker-compose exec frontend npm run build
```

### 테스트 계정

| 사번 | 비밀번호 | 역할 | 테스트 용도 |
|------|---------|------|-----------|
| admin | admin123 | admin | 전체 기능 + 권한 관리 테스트 |
| editor | editor123 | editor | 태스크 CRUD + 업로드 테스트 |
| viewer | viewer123 | viewer | 읽기 전용 + 권한 제한 테스트 |
| pending | pending123 | none | 승인 대기 흐름 테스트 |

---

## 기술 고려사항

### pgvector 인덱스 전략
- 노드 3,000개 규모에서 IVFFlat (lists=100) 사용
- 데이터 증가 시 HNSW 인덱스로 전환 검토 (pgvector >= 0.5.0)

### OpenAI API 안정성
- 태깅/임베딩 모두 3초 타임아웃 설정
- 실패 시 graceful degradation (태그 없이 저장, 임베딩 null 허용)
- 업로드 시 batch embedding은 별도 백그라운드 처리 권장

### 100MB 업로드 메모리 관리
- 스트리밍 방식으로 디스크 임시 파일 사용
- 100명 × 100MB = 10GB RAM 방지

### 다크 테마 전환 범위
- 모든 페이지/컴포넌트 일괄 전환 (라이트/다크 토글은 미포함)
- CSS 변수 기반으로 향후 토글 기능 확장 용이하게 구성
