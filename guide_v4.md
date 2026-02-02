# PI 내역 자산화 및 Tracking 관리 시스템 PRD (v4)

> **이 문서는 AI 코딩 어시스턴트(Cursor, Windsurf 등)와 함께 개발하기 위해 최적화된 명세서입니다.**
> 데이터 무결성, 보안, 시각화 성능, 그리고 확장성을 고려하여 설계되었습니다.

---

## 1. 프로젝트 개요

### 1.1 목표

본사 업무를 L1~L4 단계로 계층화하여 시각적으로 추적 관리하고, 변경 이력을 자산화하는 웹 시스템

### 1.2 핵심 기능

- **계층적 업무 관리**: Root → L1 → L2 → L3 → L4 구조 (트리 형태)
- **이력 자산화**: 변경 시점마다 스냅샷 저장 (Audit Log)
- **그래프 시각화**: React Flow 기반의 인터랙티브 트리 그래프 (Zoom, Pan, Expand/Collapse)
- **조직 관리**: 부서별/담당자별 필터링 및 검색

### 1.3 운영 환경

- 데이터 규모: 노드 약 3,000개 이상 (렌더링 최적화 필요)
- 동시 접속: 20~50명

---

## 2. 기술 스택 및 선정 이유 (Architecture Decision Log)

### 2.1 Frontend: React 18 + TypeScript + Axios

| 기술               | 선정 이유                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **React 18**       | Concurrent Rendering을 통한 대규모 노드 렌더링 최적화                                                                              |
| **TypeScript**     | 타입 안정성 및 개발 생산성 향상                                                                                                    |
| **React Flow v11** | 계층형 그래프 시각화에 특화된 라이브러리                                                                                           |
| **Axios**          | Interceptor를 통한 JWT Silent Refresh 구현, HTTP 상태 코드별 에러 처리가 Fetch API보다 직관적, API Base URL 및 공통 헤더 설정 용이 |
| **Zustand**        | 경량 상태 관리, 불필요한 리렌더링 방지                                                                                             |
| **React Query**    | 서버 상태 캐싱 및 동기화                                                                                                           |
| **Tailwind CSS**   | 빠른 UI 개발 및 일관된 디자인 시스템                                                                                               |

### 2.2 Backend: FastAPI + SQLAlchemy 2.0

| 기술               | 선정 이유                                              |
| ------------------ | ------------------------------------------------------ |
| **FastAPI**        | 비동기(Async) 처리를 통한 성능 최적화, 자동 API 문서화 |
| **SQLAlchemy 2.0** | Async 지원, ORM 패턴으로 생산성 향상                   |
| **Pydantic v2**    | 엄격한 데이터 검증, SQL Injection 방지                 |

### 2.3 Database: PostgreSQL 15

**PostgreSQL 선택 이유 (NoSQL 대비 우위)**:

| 기능              | 설명                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| **계층형 쿼리**   | `WITH RECURSIVE`를 사용하여 L1~L4 트리를 효율적으로 탐색                |
| **데이터 무결성** | 외래키(FK) 제약을 통해 부모-자식 노드 간의 정합성 보장 (고아 노드 방지) |
| **JSONB 지원**    | 정형 데이터와 비정형 데이터를 동시에 처리 가능 (스냅샷 저장)            |
| **트랜잭션**      | Task 수정과 History 저장을 하나의 원자적 단위로 처리                    |
| **GIN Index**     | 배열 타입(keywords) 검색 최적화                                         |

### 2.4 Infra: Docker Compose

- DB, Backend, Frontend 컨테이너 오케스트레이션
- 개발/운영 환경 일관성 보장

---

## 3. 디자인 시스템

### 3.1 컬러 팔레트

```css
/* Brand Colors */
--primary: #3617ce; /* SKB Identity, Active, L3 Node */
--primary-light: #7b6be8; /* L1 Node */
--primary-mid: #5c47e0; /* L2 Node */
--primary-dark: #1a0b66; /* L4 Node */

/* State Colors */
--bg-base: #f5f5f6; /* Background */
--bg-panel: #ffffff; /* Panel/Modal Background */
--text-primary: #111111;
--text-secondary: #767676;
--border: #e0e0e0;
--danger: #cc333eff; /* Delete, Error */
--success: #25a35aff; /* Success, Safe */
```

---

## 4. 데이터 모델 및 ID 생성 전략

### 4.1 설계 원칙

0. **코드간결성**: **코드는 최대한 짧고 간결**하게 작성한다.
1. **Current State 패턴**: `tasks` 테이블은 항상 **최신 상태만** 유지 (조회 성능 최적화)
2. **Audit Log 패턴**: 수정 발생 시, 변경 전 데이터를 `task_histories` 테이블로 이관 후 업데이트
3. **UUID v4 전략**: 분산 환경 대응, 데이터 병합 시 충돌 방지, 보안(ID 추측 방지)

### 4.2 SQL 스키마 (DDL)

```sql
-- UUID 확장 모듈
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM 타입 정의
CREATE TYPE task_level AS ENUM ('Root', 'L1', 'L2', 'L3', 'L4');

-- 1. 유저 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    organization VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer', -- admin, editor, viewer
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 업무 마스터 테이블 (Current State)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES tasks(id) ON DELETE RESTRICT,
    level task_level NOT NULL,
    name VARCHAR(200) NOT NULL,

    -- 업무 속성
    organization VARCHAR(100) NOT NULL,
    team VARCHAR(100),
    manager_name VARCHAR(50),
    manager_id VARCHAR(20),
    keywords TEXT[], -- PostgreSQL Array Type

    -- L4 전용 속성
    is_ai_utilized BOOLEAN DEFAULT false,

    -- 메타 데이터
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft Delete
);

-- 인덱스: 계층 조회 및 검색 최적화
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_level ON tasks(level);
CREATE INDEX idx_tasks_org ON tasks(organization);
CREATE INDEX idx_tasks_keywords ON tasks USING GIN(keywords);

-- 3. 이력 관리 테이블 (Audit Log) - JSONB 스냅샷 방식
CREATE TABLE task_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id),

    -- 스냅샷 데이터 (JSONB로 당시 전체 데이터 저장)
    snapshot JSONB NOT NULL,

    -- 메타 데이터
    version INTEGER NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 이력 조회 인덱스
CREATE INDEX idx_task_histories_task_id ON task_histories(task_id);
CREATE INDEX idx_task_histories_changed_at ON task_histories(changed_at DESC);
```

### 4.3 핵심 유틸리티 로직

#### Backend: SQLAlchemy Model (Python)

```python
import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, ARRAY, text
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Task(Base):
    __tablename__ = "tasks"

    # Python 레벨에서도 기본값으로 uuid4 지정 (DB와 이중화)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="RESTRICT"),
        nullable=True
    )
    level: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organization: Mapped[str] = mapped_column(String(100), nullable=False)
    team: Mapped[str | None] = mapped_column(String(100), nullable=True)
    manager_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    manager_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    is_ai_utilized: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Relationships
    parent = relationship("Task", remote_side=[id], backref="children")
```

#### Frontend: Axios Instance 및 Client-side ID Generation (TypeScript)

```typescript
// src/api/client.ts
import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: JWT 토큰 주입
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: 401 에러 시 Silent Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await axios.post("/api/auth/refresh", {
          refresh_token: refreshToken,
        });

        useAuthStore
          .getState()
          .setTokens(data.access_token, data.refresh_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

// src/utils/id.ts
// 신규 노드를 서버에 저장하기 전, UI에 즉시 표시하기 위한 임시 ID 생성
export const generateId = (): string => {
  return window.crypto.randomUUID();
};
```

---

## 5. API 명세

### 5.1 응답 래퍼 (Common Response)

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  error_code?: string;
}
```

### 5.2 인증 (Auth)

| Method | Endpoint            | 설명                      |
| ------ | ------------------- | ------------------------- |
| POST   | `/api/auth/login`   | Access/Refresh Token 발급 |
| POST   | `/api/auth/refresh` | Access Token 갱신         |
| GET    | `/api/auth/me`      | 내 정보 조회              |

### 5.3 노드 관리 (Tasks)

| Method | Endpoint                  | 설명                                              |
| ------ | ------------------------- | ------------------------------------------------- |
| GET    | `/api/tasks/graph`        | 초기 그래프 렌더링용 경량 데이터 조회 (Flat List) |
| GET    | `/api/tasks/{id}`         | 노드 상세 정보 조회                               |
| POST   | `/api/tasks`              | 신규 노드 생성                                    |
| PUT    | `/api/tasks/{id}`         | 노드 수정 (이력 생성 포함)                        |
| DELETE | `/api/tasks/{id}`         | Soft Delete (자식 노드 있으면 불가)               |
| GET    | `/api/tasks/{id}/history` | 해당 노드의 변경 이력 조회                        |

#### GET /api/tasks/graph 상세

- **목적**: 초기 그래프 렌더링을 위한 경량 데이터 조회
- **필터 파라미터**: `organization`, `level`, `is_ai_utilized`
- **응답**: 트리 구조가 아닌 **Flat List** (클라이언트에서 트리 구성)
- **필드**: `id`, `parent_id`, `name`, `level`, `organization`, `is_ai_utilized`

---

## 6. Phase별 구현 가이드

### Phase 1: 프로젝트 초기화 및 인프라

#### 1-1. 디렉토리 구조

```
pi-management/
├── backend/
│   ├── app/
│   │   ├── api/          # Endpoints
│   │   ├── core/         # Config, Security
│   │   ├── db/           # Session, Base
│   │   ├── models/       # SQLAlchemy Models
│   │   ├── schemas/      # Pydantic Models
│   │   ├── services/     # Business Logic (CRUD, History)
│   │   └── main.py
│   ├── alembic/          # DB Migrations
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios setup
│   │   ├── components/   # shared, graph, layout
│   │   ├── hooks/        # React Query hooks
│   │   ├── stores/       # Zustand
│   │   ├── types/        # TypeScript interfaces
│   │   └── utils/        # Graph layout logic
│   └── Dockerfile
└── docker-compose.yml
```

#### 1-2. 라이브러리 설정

**Backend:**

```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
pydantic-settings
python-jose[cryptography]
passlib[bcrypt]
alembic
```

**Frontend:**

```
reactflow
dagre
@types/dagre
clsx
tailwind-merge
lucide-react
react-hook-form
@tanstack/react-query
zustand
react-hot-toast
```

#### 1-3. Docker Compose 설정

```yaml
version: "3.8"
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: pi_user
      POSTGRES_PASSWORD: pi_password
      POSTGRES_DB: pi_management
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://pi_user:pi_password@db:5432/pi_management
    depends_on:
      - db
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

### Phase 2: Backend Core 구현

#### 2-1. 인증 시스템

- JWT Access Token (15분) / Refresh Token (7일) 발급
- Password hashing with bcrypt
- Role-based access control (admin, editor, viewer)

#### 2-2. Task CRUD 및 이력 관리

**Task Creation 로직:**

- `level` 검증: Parent의 level에 따라 자동 결정 (Root → L1 → L2 → L3 → L4)
- `L4`일 경우 `parent_id`가 `L3`여야 함
- 부모 노드의 `organization`, `keywords` 등 상속 처리

**Task Update 서비스 (트랜잭션):**

```python
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import json

async def update_task(
    db: AsyncSession,
    task_id: UUID,
    update_data: TaskUpdate,
    user_id: UUID
):
    # 1. 현재 Task 조회
    task = await db.get(Task, task_id)
    if not task:
        raise NotFoundException("Task not found")

    # 2. 현재 상태를 History에 스냅샷으로 저장
    snapshot = {
        "parent_id": str(task.parent_id) if task.parent_id else None,
        "level": task.level,
        "name": task.name,
        "organization": task.organization,
        "team": task.team,
        "manager_name": task.manager_name,
        "manager_id": task.manager_id,
        "keywords": task.keywords,
        "is_ai_utilized": task.is_ai_utilized,
    }

    history = TaskHistory(
        task_id=task.id,
        snapshot=snapshot,
        version=task.version,
        change_type='UPDATE',
        changed_by=user_id
    )
    db.add(history)

    # 3. Task 업데이트
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(task, key, value)
    task.version += 1
    task.updated_by = user_id
    task.updated_at = datetime.utcnow()

    # 4. 트랜잭션 커밋
    await db.commit()
    await db.refresh(task)
    return task
```

#### 2-3. 계층형 쿼리 (Recursive CTE)

```python
async def get_task_tree(db: AsyncSession, root_id: UUID | None = None):
    """전체 트리 또는 특정 노드 하위 트리 조회"""

    query = text("""
        WITH RECURSIVE task_tree AS (
            -- Base case: root nodes
            SELECT id, parent_id, level, name, organization, is_ai_utilized, 0 as depth
            FROM tasks
            WHERE parent_id IS NULL AND deleted_at IS NULL

            UNION ALL

            -- Recursive case: child nodes
            SELECT t.id, t.parent_id, t.level, t.name, t.organization, t.is_ai_utilized, tt.depth + 1
            FROM tasks t
            INNER JOIN task_tree tt ON t.parent_id = tt.id
            WHERE t.deleted_at IS NULL
        )
        SELECT * FROM task_tree ORDER BY depth, name;
    """)

    result = await db.execute(query)
    return result.fetchall()
```

---

### Phase 3: Frontend 인증 및 기본 레이아웃

#### 3-1. Auth Store (Zustand)

```typescript
// src/stores/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "auth-storage" },
  ),
);
```

#### 3-2. Protected Route

```typescript
// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export const ProtectedRoute = () => {
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
```

---

### Phase 4: 그래프 시각화 (핵심)

#### 4-1. 레이아웃 알고리즘 (Dagre)

```typescript
// src/utils/layout.ts
import dagre from "dagre";
import { Node, Edge } from "reactflow";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
```

#### 4-2. 커스텀 노드 컴포넌트

```typescript
// src/components/graph/TaskNode.tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { clsx } from 'clsx';

const levelColors = {
  Root: 'bg-gray-700',
  L1: 'bg-primary-light',
  L2: 'bg-primary-mid',
  L3: 'bg-primary',
  L4: 'bg-primary-dark',
};

export const TaskNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-lg shadow-md border-2 min-w-[180px]',
        levelColors[data.level as keyof typeof levelColors],
        selected ? 'border-yellow-400 ring-2 ring-yellow-200' : 'border-transparent',
        'text-white'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="flex items-center justify-between">
        <span className="text-xs opacity-75">{data.level}</span>
        {data.is_ai_utilized && (
          <span className="px-1.5 py-0.5 text-xs bg-yellow-400 text-black rounded font-bold">
            AI
          </span>
        )}
      </div>
      <div className="font-medium truncate mt-1">{data.name}</div>
      <div className="text-xs opacity-75 truncate">{data.organization}</div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
});
```

#### 4-3. 그래프 컨테이너

```typescript
// src/components/graph/TaskGraph.tsx
import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TaskNode } from './TaskNode';
import { getLayoutedElements } from '@/utils/layout';

const nodeTypes = { task: TaskNode };

interface TaskGraphProps {
  tasks: TaskGraphItem[];
  onNodeClick: (taskId: string) => void;
}

export const TaskGraph = ({ tasks, onNodeClick }: TaskGraphProps) => {
  // Transform API data to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = tasks.map((task) => ({
      id: task.id,
      type: 'task',
      position: { x: 0, y: 0 },
      data: {
        name: task.name,
        level: task.level,
        organization: task.organization,
        is_ai_utilized: task.is_ai_utilized,
      },
    }));

    const edges: Edge[] = tasks
      .filter((task) => task.parent_id)
      .map((task) => ({
        id: `${task.parent_id}-${task.id}`,
        source: task.parent_id!,
        target: task.id,
        type: 'smoothstep',
      }));

    return getLayoutedElements(nodes, edges);
  }, [tasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={1.5}
      onlyRenderVisibleElements // 대규모 노드(3,000개+) 렌더링 최적화
    >
      <Background />
      <Controls />
      <MiniMap nodeColor={(node) => levelColors[node.data.level] || '#666'} />
    </ReactFlow>
  );
};
```

---

### Phase 5: 인터랙션 및 편집

#### 5-1. 상세 패널 (우측 사이드바)

- **View 모드**: 노드 정보 표시
- **Edit 모드**: 입력 폼으로 전환 (`react-hook-form` 사용)
- **History 탭**: 해당 노드의 과거 이력을 리스트로 표시

#### 5-2. 노드 조작

- **추가**: 부모 노드 우클릭 → "하위 업무 추가" → 모달 팝업
- **삭제**: 자식 노드가 없는 경우에만 삭제 버튼 활성화

---

### Phase 6: 검색 및 필터링

#### 6-1. 구현 방식

1. **Frontend Filtering**:
   - `/api/tasks/graph`로 전체 데이터를 받아온 상태에서 클라이언트 사이드 필터링 우선 수행 (반응성 향상)
   - 필터링 된 노드와 그 **조상(Parent) 노드**들만 남기고 나머지는 `hidden: true` 처리 (맥락 유지)

2. **Search Highlight**:
   - 검색어 입력 시 매칭되는 노드의 테두리 색상 변경 및 `fitView`로 줌인

```typescript
// src/utils/filter.ts
export const filterNodesWithAncestors = (
  tasks: TaskGraphItem[],
  predicate: (task: TaskGraphItem) => boolean,
): Set<string> => {
  const visibleIds = new Set<string>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // 필터 조건에 맞는 노드 찾기
  const matchingTasks = tasks.filter(predicate);

  // 매칭된 노드와 그 조상들을 visible로 설정
  matchingTasks.forEach((task) => {
    let current: TaskGraphItem | undefined = task;
    while (current) {
      visibleIds.add(current.id);
      current = current.parent_id ? taskMap.get(current.parent_id) : undefined;
    }
  });

  return visibleIds;
};
```

---

### Phase 7: 관리자 기능 및 배포

#### 7-1. 사용자 관리

- 사번, 이름, 권한(Admin/Editor/Viewer) 관리
- 초기 Admin 계정은 DB Seed 스크립트로 생성

#### 7-2. 배포 설정

- **Docker Compose**: DB, Backend, Frontend 컨테이너 오케스트레이션
- **Nginx (Optional)**: 리버스 프록시 설정 (Frontend 정적 서빙 + API 프록시)

---

## 7. 보안 및 성능 체크리스트

### 보안

- [ ] 모든 API 요청에 대해 JWT 유효성 검증
- [ ] 입력값 검증: Pydantic 모델을 통한 SQL Injection 방지
- [ ] Password hashing with bcrypt (cost factor ≥ 12)
- [ ] CORS 설정 (허용 도메인 제한)

### 성능

- [ ] DB 인덱스: `tasks.parent_id`, `tasks.organization`, `tasks.keywords` (GIN index)
- [ ] 프론트엔드: 대규모 노드(3,000개+) 렌더링 시 `onlyRenderVisibleElements` 옵션 활성화
- [ ] API 응답 캐싱: React Query staleTime 설정

### 코드 품질

- [ ] Zustand Store: 그래프 데이터(Nodes/Edges)와 UI 상태 분리하여 불필요한 리렌더링 방지
- [ ] Pydantic 모델에서 ORM 모드 사용 시 순환 참조 주의 (Schema 분리)
- [ ] Error Handling: API 에러 시 Toast 메시지 표시 (React Hot Toast)

---

## 부록: TypeScript 타입 정의

```typescript
// src/types/task.ts
export interface TaskGraphItem {
  id: string;
  parent_id: string | null;
  level: "Root" | "L1" | "L2" | "L3" | "L4";
  name: string;
  organization: string;
  is_ai_utilized: boolean;
}

export interface TaskDetail extends TaskGraphItem {
  team: string | null;
  manager_name: string | null;
  manager_id: string | null;
  keywords: string[] | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  snapshot: TaskDetail;
  version: number;
  change_type: "CREATE" | "UPDATE" | "DELETE";
  changed_by: string | null;
  changed_at: string;
}

export interface TaskCreate {
  parent_id: string | null;
  name: string;
  organization: string;
  team?: string;
  manager_name?: string;
  manager_id?: string;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

export interface TaskUpdate {
  name?: string;
  organization?: string;
  team?: string;
  manager_name?: string;
  manager_id?: string;
  keywords?: string[];
  is_ai_utilized?: boolean;
}
```
