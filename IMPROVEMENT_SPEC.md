# PI Management System - 개선 필요 내역 상세 명세서

> **목적**: Codex / Claude 등 AI 코딩 어시스턴트가 각 개선 항목을 독립적으로 구현할 수 있도록 작성된 상세 명세서
> **기준 문서**: `guide_v5.md` (PRD v5)
> **작성일**: 2026-03-11
> **우선순위**: 🔴 Critical > 🟡 High > 🟢 Normal

---

## 목차

1. [IMP-01] 로그인 유지 - Refresh Token Silent Refresh 구현
2. [IMP-02] 업무 그래프 - L1 기준 전체 뷰
3. [IMP-03] 노드 수정 - 사이드바 인라인 편집 전환
4. [IMP-04] 노드 수정 - 조직 단위 드롭다운 체계
5. [IMP-05] 노드 수정 - L1 업무명/조직명 동일 규칙
6. [IMP-06] 노드 수정 - L4 전용 AI 활용 여부 체크
7. [IMP-07] 노드 삭제 - 하위 노드 cascade 삭제
8. [IMP-08] 엑셀 업로드 - 띄어쓰기 제외 비교
9. [IMP-09] DB 스키마 - 조직 단위 필드 추가

---

## [IMP-01] 로그인 유지 - Refresh Token Silent Refresh 구현

**우선순위**: 🔴 Critical
**현재 상태**: Refresh Token을 저장은 하지만 갱신 로직이 없어 Access Token(15분) 만료 시 자동 로그아웃됨

### 현재 문제점

**파일**: `frontend/src/api/client.ts`

현재 API 클라이언트(Fetch 기반)는 401 응답 시 즉시 로그아웃 + 로그인 페이지 리다이렉트만 수행한다.
`authStore`에 `refreshToken`을 저장하고 있지만, 이를 사용하여 Access Token을 갱신하는 로직이 없다.

```
현재 흐름:
API 호출 → 401 응답 → 즉시 logout() → /login 리다이렉트

목표 흐름:
API 호출 → 401 응답 → POST /api/auth/refresh 호출
  → 성공: 새 토큰 저장 → 원래 요청 재시도
  → 실패: logout() → /login 리다이렉트
```

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/src/api/client.ts` | 401 응답 시 Silent Refresh 로직 추가 |
| `frontend/src/stores/authStore.ts` | `setTokens()` 액션 추가 (토큰만 교체) |

### 구현 요구사항

1. **Silent Refresh 로직** (`client.ts`):
   - 401 응답 수신 시, `refreshToken`으로 `POST /api/auth/refresh` 호출
   - 성공하면 새 `accessToken`/`refreshToken`을 `authStore`에 저장
   - 원래 실패한 요청을 새 토큰으로 재시도
   - refresh 요청 자체가 실패하면(401/403) `logout()` 호출 + `/login` 리다이렉트
   - **동시 요청 처리**: 여러 API가 동시에 401을 받을 때, refresh 요청이 중복 발생하지 않도록 Promise 큐잉 처리
   - **재시도 방지 플래그**: 이미 refresh를 시도한 요청은 다시 refresh하지 않음 (무한루프 방지)

2. **authStore 수정** (`authStore.ts`):
   - `setTokens(accessToken, refreshToken)` 액션 추가
   - 기존 `login()` 내부에서도 이 액션을 재사용

### 동시 요청 처리 로직 (참고)

```
- refreshPromise 변수를 모듈 레벨에서 관리
- 첫 번째 401 요청이 refresh를 트리거 → refreshPromise에 저장
- 이후 401 요청들은 동일한 refreshPromise를 await
- refresh 완료 후 refreshPromise를 null로 초기화
- 모든 대기 중인 요청은 새 토큰으로 재시도
```

### 테스트 시나리오

- [ ] Access Token 만료 후 API 호출 시 자동 갱신되는지 확인
- [ ] 여러 API가 동시에 401을 받아도 refresh 요청은 1회만 발생하는지 확인
- [ ] Refresh Token도 만료된 경우 로그인 페이지로 이동하는지 확인
- [ ] 새로고침 후에도 토큰이 유지되는지 확인 (localStorage persist)

---

## [IMP-02] 업무 그래프 - L1 기준 전체 뷰

**우선순위**: 🟡 High
**현재 상태**: 전체 그래프만 볼 수 있으며, 특정 L1의 하위 트리만 집중 조회하는 기능 없음

### 현재 동작

`FilterBar.tsx`에서 레벨(L1~L4) 필터와 조직 필터는 있지만, "특정 L1을 선택하여 해당 하위 전체를 펼쳐 보는" 기능이 없다.

### 목표 동작

```
1. FilterBar에 "L1 선택" 드롭다운 추가 (또는 L1 노드 더블클릭)
2. 특정 L1을 선택하면:
   - 같은 그래프 페이지에서 Root + 해당 L1 + 모든 하위(L2→L3→L4)만 표시
   - 나머지 L1들과 그 하위는 숨김
   - 선택된 L1의 모든 하위 노드를 자동 확장(expand)
3. "전체 보기" 버튼으로 원래 전체 그래프로 복귀
```

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/src/components/graph/FilterBar.tsx` | L1 선택 드롭다운 추가, "전체 보기" 복귀 버튼 |
| `frontend/src/stores/taskStore.ts` | `focusedL1Id` 상태 + `setFocusedL1(id)` 액션 추가 |
| `frontend/src/components/graph/TaskGraph.tsx` | `focusedL1Id` 기반 필터링 + 자동 expand 로직 |

### 구현 요구사항

1. **taskStore 상태 추가** (`taskStore.ts`):
   - `focusedL1Id: string | null` — 현재 포커스된 L1 노드 ID
   - `setFocusedL1(id: string | null)` — L1 포커스 설정/해제
   - `focusedL1Id` 설정 시 해당 L1과 모든 하위 노드를 `expandedNodes`에 추가

2. **FilterBar 수정** (`FilterBar.tsx`):
   - 기존 필터 옆에 "L1 업무 선택" 드롭다운 추가
   - tasks에서 `level === 'L1'`인 항목들을 옵션으로 표시
   - 선택 시 `setFocusedL1(id)` 호출
   - 활성 상태일 때 "전체 보기" 버튼 표시 → `setFocusedL1(null)` 호출

3. **TaskGraph 필터링** (`TaskGraph.tsx`):
   - `focusedL1Id`가 설정되면:
     - Root 노드 + 해당 L1 노드 + 해당 L1의 모든 자손 노드만 표시
     - 재귀적으로 `parent_id` 체인을 따라 하위 노드를 수집
     - 모든 수집된 노드를 `expandedNodes`에 자동 추가
   - `focusedL1Id`가 null이면 기존 전체 그래프 로직 유지

4. **UX 고려사항**:
   - L1 포커스 모드에서 `fitView()` 호출하여 화면에 맞춤
   - 포커스 모드임을 나타내는 상단 배너/배지 표시 (예: "📌 [L1 이름] 하위 업무 보기")
   - 기존 조직/AI 필터와 조합 가능하도록 처리

### 테스트 시나리오

- [ ] L1 선택 시 해당 하위만 표시되는지 확인
- [ ] 전체 보기로 복귀 시 원래 그래프가 복원되는지 확인
- [ ] L1 포커스 + 조직 필터 동시 적용 시 정상 작동 확인
- [ ] 포커스 전환 시 `fitView()`로 화면 재조정 확인

---

## [IMP-03] 노드 수정 - 사이드바 인라인 편집 전환

**우선순위**: 🟡 High
**현재 상태**: 노드 수정 시 별도 `TaskFormModal`이 열려 상세보기 → 수정 버튼 클릭 → 모달의 2단계를 거침

### 현재 동작

```
노드 클릭 → DetailSidebar에 상세 정보 표시(읽기 전용)
→ "수정" 버튼 클릭 → TaskFormModal 오픈 → 모달에서 수정 → 저장
```

### 목표 동작

```
노드 클릭 → DetailSidebar에 상세 정보 표시(읽기 전용)
→ "수정" 버튼 클릭 → 같은 사이드바에서 인라인 편집 폼으로 전환
→ "저장" 버튼 → API 호출 → 다시 읽기 전용으로 복귀
```

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/src/components/graph/DetailSidebar.tsx` | 읽기/편집 모드 토글, 인라인 폼 추가 |
| `frontend/src/components/graph/DetailPanel.tsx` | 편집 모드 시 폼 입력 필드로 전환 |

### 구현 요구사항

1. **DetailSidebar 모드 전환** (`DetailSidebar.tsx`):
   - 로컬 상태 `isEditing: boolean` 추가
   - `isEditing === false`: 기존 읽기 전용 뷰 유지
   - `isEditing === true`: 입력 폼으로 전환
   - "수정" 버튼 클릭 → `isEditing = true`
   - "저장" 버튼 클릭 → `updateTask()` 호출 → 성공 시 `isEditing = false`
   - "취소" 버튼 클릭 → 변경 사항 버리고 `isEditing = false`
   - 다른 노드 선택 시 → 자동으로 `isEditing = false`로 리셋

2. **인라인 편집 폼 필드**:
   - `name`: 텍스트 입력 (필수)
   - `organization_type`: 드롭다운 — 본부/실/담당/팀 ([IMP-04] 참조)
   - `organization`: 텍스트 입력 — 조직명
   - `team`: 텍스트 입력
   - `manager_name`: 텍스트 입력
   - `manager_id`: 텍스트 입력
   - `keywords`: 콤마 구분 텍스트 입력
   - `is_ai_utilized`: 체크박스 (L4일 때만 표시, [IMP-06] 참조)

3. **UX 고려사항**:
   - 편집 모드 진입 시 기존 값을 폼에 프리필
   - 수정 중 unsaved changes가 있을 때 다른 노드 클릭 시 확인 경고
   - 저장 중 로딩 상태 표시
   - 저장 성공 시 toast 알림

4. **TaskFormModal 유지**:
   - 수정용 모달은 제거하되, **생성용 모달**(`TaskFormModal`)은 "하위 업무 추가" 시 그대로 유지
   - `GlobalModal`에서 `type === 'edit'` 처리 분기 제거 또는 사이드바로 위임

### 테스트 시나리오

- [ ] 수정 버튼 클릭 시 사이드바가 인라인 편집 폼으로 전환되는지 확인
- [ ] 저장 시 API 호출 + 그래프 노드 업데이트 확인
- [ ] 취소 시 원래 값으로 복귀 확인
- [ ] 편집 중 다른 노드 클릭 시 확인 경고 표시 확인

---

## [IMP-04] 노드 수정 - 조직 단위 드롭다운 체계

**우선순위**: 🟡 High
**현재 상태**: `organization` 필드가 자유 텍스트 입력이며 조직 단위(본부/실/담당/팀) 구분 없음
**선행 작업**: [IMP-09] DB 스키마 변경

### 목표

조직 입력을 **조직 단위(드롭다운)** + **조직명(텍스트 입력)**으로 분리한다.

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/src/components/graph/DetailSidebar.tsx` | 인라인 편집 시 조직 단위 드롭다운 추가 |
| `frontend/src/components/graph/TaskFormModal.tsx` | 생성 모달에도 조직 단위 드롭다운 추가 |
| `frontend/src/types/task.ts` | `OrganizationType` 타입 정의 |
| `backend/app/schemas/task.py` | `organization_type` 필드 추가 |
| `backend/app/services/task_service.py` | 생성/수정 시 `organization_type` 처리 |

### 구현 요구사항

1. **타입 정의** (`task.ts`):
   ```typescript
   type OrganizationType = '본부' | '실' | '담당' | '팀';
   ```

2. **UI 입력 방식**:
   - **조직 단위**: `<select>` 드롭다운 — 본부 / 실 / 담당 / 팀
   - **조직명**: `<input type="text">` — 사용자 자유 입력
   - 표시 형식: `{조직명} ({조직 단위})` (예: "AI전략 (담당)")

3. **기존 데이터 호환**:
   - `organization_type`이 `NULL`이면 드롭다운을 "선택 없음"으로 표시
   - 기존 `organization` 값은 그대로 유지

### 테스트 시나리오

- [ ] 드롭다운에서 조직 단위 선택 가능 확인
- [ ] 저장 시 `organization_type`과 `organization`이 모두 저장되는지 확인
- [ ] 기존 데이터(organization_type=NULL)가 정상 표시되는지 확인

---

## [IMP-05] 노드 수정 - L1 업무명/조직명 동일 규칙

**우선순위**: 🟢 Normal
**현재 상태**: L1 노드의 `name`과 `organization`을 독립적으로 입력 가능

### 목표

L1 레벨 노드는 **업무명(name)**과 **조직명(organization)**이 항상 동일해야 한다.

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/src/components/graph/DetailSidebar.tsx` | L1 편집 시 name ↔ organization 동기화 |
| `frontend/src/components/graph/TaskFormModal.tsx` | L1 생성 시 name ↔ organization 동기화 |
| `backend/app/services/task_service.py` | L1 생성/수정 시 서버측 검증 |

### 구현 요구사항

1. **프론트엔드 동기화**:
   - L1 노드 편집/생성 시, `name` 필드 입력 값을 `organization` 필드에 자동 복사
   - `organization` 필드는 L1에서 **읽기 전용**(disabled)으로 표시
   - L2, L3, L4에서는 기존대로 독립 입력

2. **백엔드 검증** (`task_service.py`):
   - L1 레벨 `create_task` / `update_task` 시:
     - `organization`이 제공되지 않았으면 `name` 값으로 자동 설정
     - `organization`이 `name`과 다르면 자동 맞춤

### 테스트 시나리오

- [ ] L1 노드 생성 시 name 입력하면 organization이 자동 동기화되는지 확인
- [ ] L1 노드 수정 시 name 변경하면 organization도 함께 변경되는지 확인
- [ ] L2~L4에서는 name과 organization이 독립적으로 입력 가능한지 확인

---

## [IMP-06] 노드 수정 - L4 전용 AI 활용 여부 체크

**우선순위**: 🟢 Normal
**현재 상태**: 모든 레벨의 노드에서 `is_ai_utilized` 체크박스가 표시됨

### 목표

`is_ai_utilized` 체크박스는 **L4 레벨 노드에서만** 표시되고, 나머지 레벨에서는 숨긴다.

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `frontend/src/components/graph/DetailSidebar.tsx` | `level === 'L4'`일 때만 AI 체크박스 표시 |
| `frontend/src/components/graph/TaskFormModal.tsx` | 생성 모달에서도 부모가 L3(=자식이 L4)일 때만 표시 |
| `frontend/src/components/graph/TaskNode.tsx` | L4 노드에서만 AI 배지 아이콘 표시 |
| `backend/app/services/task_service.py` | L4 외 레벨에서 `is_ai_utilized=true` 요청 시 강제 false |

### 구현 요구사항

1. **사이드바 인라인 편집** (`DetailSidebar.tsx`):
   - `selectedTask.level === 'L4'`일 때만 `is_ai_utilized` 체크박스 렌더링
   - 다른 레벨에서는 해당 필드 섹션 자체를 숨김

2. **생성 모달** (`TaskFormModal.tsx`):
   - 부모 태스크의 level이 `L3`이면 (= 생성되는 자식이 L4) AI 체크박스 표시
   - 부모가 Root/L1/L2이면 AI 체크박스 숨김

3. **노드 시각화** (`TaskNode.tsx`):
   - `data.level === 'L4' && data.is_ai_utilized` 조건에서만 AI 배지(Sparkles) 표시

4. **백엔드 방어** (`task_service.py`):
   - `create_task` / `update_task`에서 `level !== 'L4'`이면 `is_ai_utilized`를 강제로 `false`로 설정

### 테스트 시나리오

- [ ] L4 노드 편집 시 AI 활용 체크박스가 보이는지 확인
- [ ] L1~L3 노드 편집 시 AI 활용 체크박스가 숨겨지는지 확인
- [ ] L4 생성 시 AI 체크박스 표시, L3 이하 생성 시 숨김 확인
- [ ] 백엔드: L2 노드에 `is_ai_utilized=true` 보내도 false로 저장되는지 확인

---

## [IMP-07] 노드 삭제 - 하위 노드 cascade 삭제

**우선순위**: 🔴 Critical
**현재 상태**: 자식 노드가 있는 경우 삭제가 차단됨 (FK RESTRICT + 서비스 로직)

### 현재 동작

```python
# backend/app/services/task_service.py - delete_task()
children = await db.execute(
    select(Task).where(Task.parent_id == task_id, Task.deleted_at.is_(None))
)
if children.scalars().first():
    return None  # 삭제 거부
```

```python
# backend/app/models/task.py
parent_id = Column(UUID, ForeignKey("tasks.id", ondelete="RESTRICT"))
```

### 목표 동작

```
1. 사용자가 상위 노드 "삭제" 클릭
2. 영향받는 하위 노드 목록을 트리 형태로 표시하는 확인 모달 오픈
   예: "다음 3개의 하위 업무가 함께 삭제됩니다:
        ├─ L2 업무A
        │  ├─ L3 업무B
        │  └─ L3 업무C
        └─ L2 업무D"
3. "삭제" 확인 → 상위 + 하위 모두 Soft Delete
4. 이력에 각 노드별 DELETE 스냅샷 기록
```

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `backend/app/models/task.py` | FK `ondelete` 제약 변경 (RESTRICT → NO ACTION) |
| `backend/app/services/task_service.py` | cascade soft delete 로직 구현 |
| `backend/app/api/tasks.py` | 삭제 전 하위 노드 목록 반환 API 추가 |
| `frontend/src/api/taskApi.ts` | 하위 노드 조회 API 함수 추가 |
| `frontend/src/components/graph/DetailSidebar.tsx` | 삭제 확인 모달에 하위 트리 표시 |
| `frontend/src/components/shared/ConfirmModal.tsx` | 트리 형태 하위 목록 표시 지원 |

### 구현 요구사항

1. **하위 노드 조회 API 추가** (`tasks.py`):
   - `GET /api/tasks/{id}/descendants` — 해당 노드의 모든 하위 노드를 재귀적으로 반환
   - 응답: `TaskGraphItem[]` (트리 구성 가능하도록 `parent_id` 포함)
   - Recursive CTE 활용:
     ```sql
     WITH RECURSIVE descendants AS (
       SELECT * FROM tasks WHERE parent_id = :task_id AND deleted_at IS NULL
       UNION ALL
       SELECT t.* FROM tasks t
       JOIN descendants d ON t.parent_id = d.id
       WHERE t.deleted_at IS NULL
     )
     SELECT * FROM descendants;
     ```

2. **Cascade Soft Delete 로직** (`task_service.py`):
   ```
   delete_task_cascade(task_id, user_id):
     1. 대상 노드 + 모든 하위 노드를 재귀 조회
     2. 각 노드에 대해:
        a. 현재 상태를 snapshot으로 task_histories에 저장 (change_type='DELETE')
        b. deleted_at = current_timestamp 설정
     3. 리프 노드부터 루트 방향으로 처리 (FK 충돌 방지)
     4. 단일 트랜잭션으로 커밋
   ```

3. **FK 제약 수정** (`task.py`):
   - `ondelete="RESTRICT"` → `ondelete="NO ACTION"`으로 변경
   - Soft Delete 방식이므로 실제 레코드 삭제가 아니어서 FK 충돌은 발생하지 않음

4. **프론트엔드 확인 모달**:
   - 삭제 버튼 클릭 시 `GET /api/tasks/{id}/descendants` 호출
   - 하위 노드가 있으면 트리 형태로 목록 표시 + 총 개수 안내
   - 하위 노드가 없으면 기존 단순 확인 모달
   - "정말 삭제하시겠습니까? 하위 {N}개 업무가 함께 삭제됩니다." 문구
   - 트리 뷰는 들여쓰기(indent)로 계층 표현

### 테스트 시나리오

- [ ] 자식 없는 노드 삭제 시 기존처럼 단순 확인 모달 표시
- [ ] 자식 있는 노드 삭제 시 하위 트리 목록이 확인 모달에 표시되는지 확인
- [ ] 삭제 확인 후 상위 + 모든 하위가 Soft Delete되는지 확인
- [ ] 삭제된 모든 노드에 대해 DELETE 이력이 생성되는지 확인
- [ ] 삭제 후 그래프에서 해당 노드들이 사라지는지 확인
- [ ] Root 노드는 삭제 불가 상태 유지 확인

---

## [IMP-08] 엑셀 업로드 - 띄어쓰기 제외 비교

**우선순위**: 🟢 Normal
**현재 상태**: 엑셀 업로드 Diff 비교 시 띄어쓰기(공백)를 포함하여 정확히 비교

### 현재 문제점

엑셀 파일의 태스크명에 공백이 추가/제거된 경우 (예: `"AI 전략"` vs `"AI전략"`) 서로 다른 항목으로 인식되어 "신규"로 분류됨.

### 목표

태스크명(`name`) 비교 시 **모든 공백(스페이스, 탭 등)을 제거한 후 비교**하여, 공백만 다른 경우는 "기존"으로 정확히 분류한다.

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `backend/app/services/upload_service.py` | diff 비교 시 name 필드 공백 제거 정규화 |

### 구현 요구사항

1. **공백 정규화 함수 추가**:
   ```python
   import re

   def normalize_name(name: str) -> str:
       """비교용 정규화: 모든 공백 제거"""
       return re.sub(r'\s+', '', name.strip())
   ```

2. **Diff 비교 로직 수정**:
   - 기존 DB 태스크의 `name`과 엑셀 태스크의 `name`을 `normalize_name()`으로 변환 후 비교
   - 비교 키: `normalize_name(name)` + `level` + `parent` 조합
   - **저장은 원본 유지**: 정규화는 비교 시에만 사용하고, 실제 DB 저장은 엑셀 원본 값 사용

3. **정규화 범위**: 태스크명(`name`) 필드만 적용 (조직명 등 다른 필드는 그대로 비교)

### 테스트 시나리오

- [ ] "AI 전략"(DB) vs "AI전략"(엑셀) → "기존"으로 분류
- [ ] "AI 전략"(DB) vs "AI 전략 수립"(엑셀) → "신규"로 분류
- [ ] 공백만 다른 항목이 "신규"로 잘못 분류되지 않는지 확인
- [ ] 저장 시 엑셀 원본 name이 그대로 저장되는지 확인

---

## [IMP-09] DB 스키마 - 조직 단위 필드 추가

**우선순위**: 🟡 High
**현재 상태**: `tasks` 테이블에 조직 단위(본부/실/담당/팀) 구분 필드 없음
**연계**: [IMP-04] 조직 단위 드롭다운 체계의 선행 작업

### 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `backend/app/models/task.py` | `organization_type` 컬럼 추가 |
| `backend/app/schemas/task.py` | Pydantic 스키마에 `organization_type` 필드 추가 |
| `backend/app/services/task_service.py` | 생성/수정 시 `organization_type` 처리 + 스냅샷 포함 |
| `backend/app/services/upload_service.py` | 엑셀 업로드 시 `organization_type` 매핑 |
| `backend/app/db/seed.py` | 시드 데이터에 `organization_type` 추가 |
| `frontend/src/types/task.ts` | `TaskGraphItem`, `TaskDetail`에 `organization_type` 추가 |

### DB 변경사항

```sql
-- tasks 테이블에 컬럼 추가
ALTER TABLE tasks ADD COLUMN organization_type VARCHAR(10);
-- 허용값: '본부', '실', '담당', '팀'
-- 기본값: NULL (기존 데이터 호환)
```

### 구현 요구사항

1. **SQLAlchemy 모델 수정** (`task.py`):
   ```python
   organization_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
   ```

2. **Pydantic 스키마 수정** (`schemas/task.py`):
   - `TaskCreate`, `TaskUpdate`: `organization_type: str | None = None` 추가
   - `TaskDetail`, `TaskGraphItem`: `organization_type: str | None` 추가
   - Validator: `organization_type`이 제공된 경우 `['본부', '실', '담당', '팀']` 중 하나인지 검증

3. **이력 스냅샷** (`task_service.py`):
   - `_task_to_snapshot()` 함수에 `organization_type` 포함

4. **프론트엔드 타입** (`task.ts`):
   ```typescript
   interface TaskGraphItem {
     // ... 기존 필드
     organization_type: '본부' | '실' | '담당' | '팀' | null;
   }
   ```

### 마이그레이션 전략

- 기존 데이터: `organization_type = NULL`
- 신규 데이터: 드롭다운 선택값 저장
- `NULL` 허용으로 하위 호환성 유지

### 테스트 시나리오

- [ ] 새 태스크 생성 시 `organization_type`이 저장되는지 확인
- [ ] 기존 태스크(organization_type=NULL) 조회 시 오류 없는지 확인
- [ ] 이력 스냅샷에 `organization_type`이 포함되는지 확인
- [ ] 잘못된 organization_type 값 요청 시 400 에러 반환 확인

---

## 구현 우선순위 및 의존성 맵

```
[IMP-01] 로그인 유지 (🔴 Critical)        ← 독립, 즉시 착수 가능
[IMP-07] Cascade 삭제 (🔴 Critical)       ← 독립, 즉시 착수 가능

[IMP-09] DB 스키마 추가 (🟡 High)          ← 독립, [IMP-04]의 선행 작업
[IMP-02] L1 전체 뷰 (🟡 High)             ← 독립, 즉시 착수 가능
[IMP-03] 인라인 편집 (🟡 High)            ← 독립, [IMP-04~06]의 기반
[IMP-04] 조직 드롭다운 (🟡 High)          ← [IMP-09] + [IMP-03] 완료 후

[IMP-05] L1 동일 규칙 (🟢 Normal)         ← [IMP-03] 완료 후
[IMP-06] L4 AI 체크 (🟢 Normal)           ← [IMP-03] 완료 후
[IMP-08] 엑셀 비교 정규화 (🟢 Normal)      ← 독립, 즉시 착수 가능
```

### 권장 구현 순서

| 순서 | 항목 | 이유 |
|------|------|------|
| 1 | [IMP-01] 로그인 유지 | 🔴 모든 작업의 기반, 개발 중 로그아웃 방지 |
| 2 | [IMP-09] DB 스키마 | 🟡 IMP-04의 선행 작업, DB 마이그레이션 먼저 |
| 3 | [IMP-07] Cascade 삭제 | 🔴 BE 로직 변경, FK 제약 수정 필요 |
| 4 | [IMP-03] 인라인 편집 | 🟡 UI 개선의 기반, IMP-04~06과 연계 |
| 5 | [IMP-04] 조직 드롭다운 | 🟡 IMP-03 + IMP-09 완료 후 적용 |
| 6 | [IMP-06] L4 AI 체크 | 🟢 IMP-03과 함께 적용 가능 |
| 7 | [IMP-05] L1 동일 규칙 | 🟢 IMP-03과 함께 적용 가능 |
| 8 | [IMP-02] L1 전체 뷰 | 🟡 독립 기능, 병렬 작업 가능 |
| 9 | [IMP-08] 엑셀 비교 | 🟢 가장 작은 범위의 수정 |
