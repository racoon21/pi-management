# PI Management System - Cloudflare + Supabase 배포 가이드

## 아키텍처 개요

```
[Cloudflare Pages] ─── Frontend (React)
         │
         ▼
[Railway / Render] ─── Backend (FastAPI)
         │
         ▼
[Supabase] ─── PostgreSQL Database
```

---

## 1. Supabase 데이터베이스 설정

### 1.1 Supabase 프로젝트 생성

1. [Supabase](https://supabase.com/) 접속 및 로그인
2. **New Project** 클릭
3. 프로젝트 정보 입력:
   - **Name**: `pi-management`
   - **Database Password**: 강력한 비밀번호 설정 (저장해두기!)
   - **Region**: `Northeast Asia (Seoul)` 권장
4. **Create new project** 클릭

### 1.2 데이터베이스 연결 정보 확인

1. 프로젝트 대시보드 > **Settings** > **Database**
2. **Connection string** 섹션에서 **URI** 복사
3. 형식 예시:
```
postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

### 1.3 AsyncPG용 연결 문자열 변환

FastAPI의 asyncpg를 사용하므로 연결 문자열 수정:

```bash
# Supabase 제공 URL
postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# AsyncPG용으로 변환 (postgresql → postgresql+asyncpg)
postgresql+asyncpg://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

### 1.4 테이블 생성 (SQL Editor)

Supabase 대시보드 > **SQL Editor** > **New query**:

```sql
-- Users 테이블
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    organization VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks 테이블
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES tasks(id),
    level VARCHAR(10) NOT NULL,
    name VARCHAR(200) NOT NULL,
    organization VARCHAR(100),
    team VARCHAR(100),
    manager_name VARCHAR(50),
    manager_id VARCHAR(20),
    keywords TEXT[] DEFAULT '{}',
    is_ai_utilized BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Task History 테이블
CREATE TABLE IF NOT EXISTS task_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) NOT NULL,
    snapshot JSONB NOT NULL,
    version INTEGER NOT NULL,
    change_type VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_level ON tasks(level);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_task_histories_task_id ON task_histories(task_id);

-- 기본 관리자 계정 생성 (비밀번호: admin123)
-- bcrypt 해시값 사용
INSERT INTO users (employee_id, password_hash, name, organization, role)
VALUES (
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYWnqpX1TCOW',
    '관리자',
    '경영지원',
    'admin'
) ON CONFLICT (employee_id) DO NOTHING;
```

---

## 2. Backend 배포 (Railway)

### 2.1 Railway 프로젝트 생성

1. [Railway](https://railway.app/) 접속 및 GitHub 로그인
2. **New Project** > **Deploy from GitHub repo**
3. 저장소 선택 후 `backend` 폴더 지정

### 2.2 환경 변수 설정

Railway 대시보드 > **Variables**:

```bash
# 환경 설정
ENVIRONMENT=production
DEBUG=false

# Supabase 데이터베이스 URL (AsyncPG용)
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# JWT 시크릿 키 (터미널에서 생성: openssl rand -hex 32)
SECRET_KEY=여기에_32바이트_랜덤_문자열_입력

# 토큰 만료 시간
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS (프론트엔드 도메인)
CORS_ORIGINS_STR=https://pi-management.pages.dev

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

### 2.3 빌드 설정

Railway 대시보드 > **Settings**:

- **Root Directory**: `/backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 2.4 도메인 설정

1. **Settings** > **Networking** > **Generate Domain**
2. 생성된 도메인 복사 (예: `pi-backend-production.up.railway.app`)

---

## 3. Frontend 배포 (Cloudflare Pages)

### 3.1 Cloudflare Pages 프로젝트 생성

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) 접속
2. **Pages** > **Create a project** > **Connect to Git**
3. GitHub 저장소 연결

### 3.2 빌드 설정

- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `frontend`

### 3.3 환경 변수 설정

**Settings** > **Environment variables**:

```bash
# 프로덕션 환경
VITE_API_URL=https://pi-backend-production.up.railway.app/api
```

### 3.4 커스텀 도메인 (선택사항)

1. **Custom domains** > **Set up a custom domain**
2. 도메인 입력 및 DNS 설정

---

## 4. 배포 순서 요약

```
1. Supabase 설정
   └── 프로젝트 생성 → 테이블 생성 → 연결 문자열 복사

2. Backend 배포 (Railway)
   └── GitHub 연결 → 환경변수 설정 → 배포 → 도메인 확인

3. Frontend 배포 (Cloudflare Pages)
   └── GitHub 연결 → VITE_API_URL 설정 → 배포

4. CORS 업데이트
   └── Railway에서 CORS_ORIGINS_STR에 Cloudflare 도메인 추가
```

---

## 5. 환경 변수 전체 목록

### Supabase
| 항목 | 값 |
|------|-----|
| Project URL | `https://[ref].supabase.co` |
| Database URL | `postgresql+asyncpg://postgres.[ref]:[password]@...` |

### Backend (Railway)
| 변수명 | 값 | 설명 |
|--------|-----|------|
| `ENVIRONMENT` | `production` | 환경 구분 |
| `DEBUG` | `false` | 디버그 모드 |
| `DATABASE_URL` | Supabase URL | DB 연결 |
| `SECRET_KEY` | 랜덤 32바이트 | JWT 서명 |
| `CORS_ORIGINS_STR` | Cloudflare 도메인 | CORS 허용 |

### Frontend (Cloudflare Pages)
| 변수명 | 값 | 설명 |
|--------|-----|------|
| `VITE_API_URL` | Railway 도메인 + `/api` | API 서버 주소 |

---

## 6. 배포 후 확인

### 6.1 Backend 헬스 체크
```bash
curl https://pi-backend-production.up.railway.app/health
# 응답: {"status":"ok","environment":"production"}
```

### 6.2 Frontend 접속
- `https://pi-management.pages.dev` 접속
- 로그인 테스트 (admin / admin123)

### 6.3 CORS 확인
- 브라우저 개발자 도구 > Network 탭
- API 요청에 CORS 에러 없는지 확인

---

## 7. 트러블슈팅

### Supabase 연결 실패
```
asyncpg.exceptions.InvalidPasswordError
```
**해결**:
- 비밀번호에 특수문자가 있으면 URL 인코딩 필요
- 예: `@` → `%40`, `#` → `%23`

### CORS 에러
```
Access to fetch at '...' has been blocked by CORS policy
```
**해결**:
- Railway의 `CORS_ORIGINS_STR`에 정확한 프론트엔드 URL 입력
- `https://` 포함, 끝에 `/` 없이

### 토큰 에러
```
{"detail":"Invalid token"}
```
**해결**:
- `SECRET_KEY`가 프로덕션에서 설정되었는지 확인
- 로컬과 프로덕션의 키가 다르면 기존 토큰 무효화됨

### Rate Limit 에러
```
{"error":"Too many requests"}
```
**해결**:
- 정상 동작. 로그인 시도가 분당 5회 초과됨
- 1분 후 재시도

---

## 8. 비용 안내

| 서비스 | 무료 티어 | 유료 |
|--------|----------|------|
| **Supabase** | 500MB DB, 1GB 전송 | $25/월~ |
| **Railway** | $5 크레딧/월 | 사용량 기반 |
| **Cloudflare Pages** | 무제한 요청, 500회 빌드/월 | 무료 |

> 💡 소규모 프로젝트는 무료 티어로 충분히 운영 가능합니다.

---

## 9. 보안 체크리스트

- [ ] Supabase 비밀번호 강력하게 설정
- [ ] `SECRET_KEY` 32바이트 이상 랜덤 값 사용
- [ ] `DEBUG=false` 확인
- [ ] `CORS_ORIGINS_STR`에 실제 도메인만 허용
- [ ] Supabase Row Level Security (RLS) 활성화 검토
- [ ] Railway 로그 모니터링 설정
