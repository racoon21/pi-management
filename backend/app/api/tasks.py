from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query
from app.api.deps import DbSession, CurrentUser
from app.schemas import ApiResponse, TaskGraphItem, TaskDetail, TaskCreate, TaskUpdate, TaskHistoryResponse
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/graph", response_model=ApiResponse[list[TaskGraphItem]])
async def get_graph(
    db: DbSession,
    current_user: CurrentUser,  # 인증 필수
    organization: str | None = Query(None),
    level: str | None = Query(None),
    is_ai_utilized: bool | None = Query(None),
):
    tasks = await task_service.get_all_tasks(db)

    # 필터링
    if organization:
        tasks = [t for t in tasks if t.organization == organization]
    if level:
        tasks = [t for t in tasks if t.level == level]
    if is_ai_utilized is not None:
        tasks = [t for t in tasks if t.is_ai_utilized == is_ai_utilized]

    return ApiResponse(
        success=True,
        data=[TaskGraphItem.model_validate(t) for t in tasks],
    )


@router.get("/{task_id}", response_model=ApiResponse[TaskDetail])
async def get_task(task_id: UUID, db: DbSession, current_user: CurrentUser):  # 인증 필수
    task = await task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return ApiResponse(success=True, data=TaskDetail.model_validate(task))


@router.post("", response_model=ApiResponse[TaskDetail])
async def create_task(data: TaskCreate, db: DbSession, current_user: CurrentUser):
    try:
        task = await task_service.create_task(db, data, current_user.id)
        return ApiResponse(success=True, data=TaskDetail.model_validate(task))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{task_id}", response_model=ApiResponse[TaskDetail])
async def update_task(task_id: UUID, data: TaskUpdate, db: DbSession, current_user: CurrentUser):
    try:
        task = await task_service.update_task(db, task_id, data, current_user.id)
        return ApiResponse(success=True, data=TaskDetail.model_validate(task))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{task_id}", response_model=ApiResponse[bool])
async def delete_task(task_id: UUID, db: DbSession, current_user: CurrentUser):
    try:
        await task_service.delete_task(db, task_id, current_user.id)
        return ApiResponse(success=True, data=True, message="Task deleted")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{task_id}/history", response_model=ApiResponse[list[TaskHistoryResponse]])
async def get_history(task_id: UUID, db: DbSession, current_user: CurrentUser):  # 인증 필수
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
