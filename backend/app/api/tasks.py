from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query
from app.api.deps import DbSession, ActiveUser, EditorUser, AdminUser
from app.schemas import ApiResponse, TaskGraphItem, TaskDetail, TaskCreate, TaskUpdate, TaskHistoryResponse
from app.services import task_service
from app.core.cache import task_cache

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/graph", response_model=ApiResponse[list[TaskGraphItem]])
async def get_graph(
    db: DbSession,
    current_user: ActiveUser,  # 인증 필수
    organization: str | None = Query(None),
    level: str | None = Query(None),
    is_ai_utilized: bool | None = Query(None),
):
    has_filters = organization or level or is_ai_utilized is not None

    # 필터 없는 요청: 캐시 우선 확인
    if not has_filters:
        cached = task_cache.get()
        if cached is not None:
            return ApiResponse(success=True, data=cached)

    tasks = await task_service.get_all_tasks(db)
    result = [TaskGraphItem.model_validate(t) for t in tasks]

    # 필터 없는 전체 결과를 캐시에 저장
    if not has_filters:
        task_cache.set(result)

    # 필터 적용
    if organization:
        result = [t for t in result if t.organization == organization]
    if level:
        result = [t for t in result if t.level == level]
    if is_ai_utilized is not None:
        result = [t for t in result if t.is_ai_utilized == is_ai_utilized]

    return ApiResponse(success=True, data=result)


@router.get("/{task_id}", response_model=ApiResponse[TaskDetail])
async def get_task(task_id: UUID, db: DbSession, current_user: ActiveUser):  # 인증 필수
    task = await task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return ApiResponse(success=True, data=TaskDetail.model_validate(task))


@router.post("", response_model=ApiResponse[TaskDetail])
async def create_task(data: TaskCreate, db: DbSession, current_user: EditorUser):
    try:
        task = await task_service.create_task(db, data, current_user.id)
        task_cache.invalidate()
        return ApiResponse(success=True, data=TaskDetail.model_validate(task))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{task_id}", response_model=ApiResponse[TaskDetail])
async def update_task(task_id: UUID, data: TaskUpdate, db: DbSession, current_user: EditorUser):
    try:
        task = await task_service.update_task(db, task_id, data, current_user.id)
        task_cache.invalidate()
        return ApiResponse(success=True, data=TaskDetail.model_validate(task))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{task_id}", response_model=ApiResponse[bool])
async def delete_task(task_id: UUID, db: DbSession, current_user: AdminUser):
    try:
        await task_service.delete_task(db, task_id, current_user.id)
        task_cache.invalidate()
        return ApiResponse(success=True, data=True, message="Task deleted")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{task_id}/descendants", response_model=ApiResponse[list[TaskGraphItem]])
async def get_descendants(task_id: UUID, db: DbSession, current_user: ActiveUser):
    """[IMP-07] 하위 노드 목록 조회 (cascade 삭제 전 확인용)"""
    task = await task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    descendants = await task_service.get_descendants(db, task_id)
    return ApiResponse(
        success=True,
        data=[TaskGraphItem.model_validate(d) for d in descendants],
    )


@router.get("/{task_id}/history", response_model=ApiResponse[list[TaskHistoryResponse]])
async def get_history(task_id: UUID, db: DbSession, current_user: ActiveUser):  # 인증 필수
    histories = await task_service.get_task_histories(db, task_id)
    return ApiResponse(
        success=True,
        data=[
            TaskHistoryResponse(
                id=h.id,
                task_id=h.task_id,
                snapshot=h.snapshot,
                version=h.version,
                change_type=h.change_type,
                changed_by=h.changed_by,
                changed_by_name=h.changed_by_name,
                changed_at=h.changed_at,
            )
            for h in histories
        ],
    )
