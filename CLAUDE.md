# PI Management - 코딩 컨벤션

## 프로젝트 개요

업무 관리 시스템 (PI Management). React + FastAPI 풀스택 프로젝트.

| 구분 | 기술 스택 |
|------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, Zustand, TanStack React Query, React Router DOM 7 |
| Backend | FastAPI 0.109, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| Database | PostgreSQL 15 + pgvector, Redis (캐싱) |
| Auth | JWT (python-jose + passlib/bcrypt) |
| Infra | Docker Compose |

## 디렉토리 구조

```
pi-management/
├── frontend/
│   └── src/
│       ├── api/          # API 클라이언트 및 통신 모듈
│       ├── components/   # 재사용 가능한 UI 컴포넌트
│       ├── hooks/        # 커스텀 React 훅
│       ├── pages/        # 라우트 단위 페이지 컴포넌트
│       ├── stores/       # Zustand 스토어
│       ├── types/        # TypeScript 타입 정의
│       └── utils/        # 유틸리티 함수
├── backend/
│   └── app/
│       ├── api/          # FastAPI 라우터 (엔드포인트)
│       ├── core/         # 설정, 보안, DB 연결 등 핵심 모듈
│       ├── models/       # SQLAlchemy ORM 모델
│       ├── schemas/      # Pydantic 요청/응답 스키마
│       ├── services/     # 비즈니스 로직 서비스 레이어
│       └── utils/        # 유틸리티 함수
└── docker-compose.yml
```

---

## Frontend 컨벤션

### 컴포넌트

- **함수형 컴포넌트만 사용** (클래스 컴포넌트 금지)
- 파일명: `PascalCase.tsx` (예: `TaskFormModal.tsx`)
- 컴포넌트당 하나의 파일, `export default` 사용
- Props는 컴포넌트 파일 상단에 `interface`로 정의

```tsx
interface TaskCardProps {
  task: Task;
  onEdit: (id: string) => void;
}

export default function TaskCard({ task, onEdit }: TaskCardProps) {
  return <div>...</div>;
}
```

### 스타일링 (Tailwind CSS)

- 인라인 Tailwind 클래스 사용, 별도 CSS 파일 최소화
- 반복되는 스타일 조합은 컴포넌트로 추출 (CSS 클래스 추출보다 컴포넌트 추출 우선)
- 다크 모드: `dark:` 프리픽스 활용
- 커스텀 컬러는 `tailwind.config.js`의 theme.extend에서 관리

### 상태 관리

- **서버 상태**: TanStack React Query (`useQuery`, `useMutation`)
- **클라이언트 상태**: Zustand 스토어 (`stores/` 디렉토리)
- **로컬 UI 상태**: `useState` / `useReducer`
- React Query 키는 배열 형태로 일관되게 사용: `['tasks', taskId]`

```tsx
// API 호출은 React Query 훅으로 래핑
export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.get<Task[]>('/api/tasks'),
  });
}
```

### API 통신

- 모든 API 호출은 `api/client.ts`의 `ApiClient`를 통해 수행
- 엔드포인트 경로는 `/api/` 프리픽스로 시작
- 응답 타입은 `ApiResponse<T>` 래퍼 사용
- 401 응답 시 자동 토큰 갱신 (silent refresh) 로직이 클라이언트에 내장

### TypeScript

- `strict: true` 모드 필수
- `any` 타입 사용 금지 — `unknown`으로 대체 후 타입 가드 사용
- API 응답 타입은 `types/` 디렉토리에 정의하고 백엔드 스키마와 동기화
- 유니온 타입 활용: `type Status = 'pending' | 'in_progress' | 'done'`

### 


---

## Backend 컨벤션

### 라우터 / 엔드포인트

- 라우터 파일은 `app/api/` 하위에 리소스 단위로 분리
- URL 경로는 복수형 명사: `/api/tasks`, `/api/users`
- CRUD 순서: `create → read(list) → read(detail) → update → delete`
- 의존성 주입으로 인증/권한 처리: `Depends(get_current_user)`

```python
router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.post("/", response_model=TaskResponse)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    ...
```

### Pydantic 스키마 (v2)

- `schemas/` 디렉토리에 리소스별 파일로 분리
- 네이밍: `{Resource}Create`, `{Resource}Update`, `{Resource}Response`
- `model_config = ConfigDict(from_attributes=True)` 사용하여 ORM 모델 변환 지원
- 선택적 필드는 `field: str | None = None` 형태

```python
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    priority: int = Field(default=3, ge=1, le=5)

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    created_at: datetime
```

### SQLAlchemy 모델 (async)

- 모든 모델은 `Base`를 상속하고 `__tablename__` 명시
- PK는 UUID 타입 사용 (`server_default=func.gen_random_uuid()`)
- 공통 컬럼: `created_at`, `updated_at`, `deleted_at` (소프트 삭제)
- 감사 컬럼: `created_by`, `updated_by`
- 관계(relationship)는 `lazy="selectin"` 또는 명시적 `joinedload` 사용

```python
class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.gen_random_uuid())
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(default=None)
```

### 에러 핸들링

- `HTTPException`으로 API 에러 반환, 적절한 status_code 사용
- 400: 입력 검증 실패, 401: 인증 실패, 403: 권한 부족, 404: 리소스 없음
- 비즈니스 로직 에러는 서비스 레이어에서 커스텀 예외로 발생시키고, 라우터에서 HTTPException으로 변환

### 비동기 패턴

- DB 세션은 `async with` 또는 의존성 주입으로 관리
- I/O 바운드 작업은 모두 `async/await` 사용
- CPU 바운드 작업은 `run_in_executor`로 별도 스레드 처리
- DB 쿼리 시 `select()` 문법 사용 (legacy Query API 사용 금지)

```python
# O: SQLAlchemy 2.0 스타일
result = await db.execute(select(Task).where(Task.id == task_id))
task = result.scalar_one_or_none()

# X: Legacy 스타일 사용 금지
# task = db.query(Task).filter(Task.id == task_id).first()
```

---

## 공통 규칙

### Git 커밋 메시지

- 형식: `<type>: <설명>` (한글 또는 영문)
- type: `feature`, `fix`
- 제목은 50자 이내, 본문은 필요시 빈 줄 후 작성
- 코딩 시작 전, 브랜치를 새로 생성하고 코딩을 시작
- 사용자 기능의 경우, /feature/user 하위 브랜치로 생성 
- 관리자 기능의 경우, /feature/admin 하위 브랜치로 생성 

```
feature: 업무 목록 필터링 기능 추가
fix: 토큰 갱신 시 무한 루프 수정
refactor: TaskService 쿼리 최적화
```

### 네이밍 컨벤션

| 구분 | Frontend | Backend |
|------|----------|---------|
| 변수/함수 | `camelCase` | `snake_case` |
| 컴포넌트/클래스 | `PascalCase` | `PascalCase` |
| 상수 | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| 파일명 | `PascalCase.tsx` (컴포넌트), `camelCase.ts` (유틸) | `snake_case.py` |
| DB 테이블/컬럼 | — | `snake_case` (복수형 테이블명) |

### 환경변수

- `.env` 파일은 Git에 포함하지 않음 (`.gitignore`)
- `.env.example`에 필요한 키 목록을 빈 값으로 유지
- Backend: `app/core/config.py`의 Pydantic `Settings` 클래스로 로드
- Frontend: `VITE_` 프리픽스 필수 (`import.meta.env.VITE_API_URL`)

### 코드 품질

- Frontend: ESLint + TypeScript strict 설정 준수
- Backend: Python 타입 힌트 필수 사용
- DB 마이그레이션: Alembic으로 관리, 수동 DDL 금지
- 새 API 추가 시 반드시 Pydantic 스키마와 타입 정의를 함께 작성


### 보안 확인 
- 수정 사항의 보안 이슈가 없는지 체크 
