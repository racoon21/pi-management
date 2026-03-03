from fastapi import APIRouter, HTTPException, UploadFile, File, status

from app.api.deps import DbSession, EditorUser
from app.schemas.common import ApiResponse
from app.schemas.upload import UploadPreview, DiffResult, UpsertResult
from app.services import upload_service

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".xlsx", ".xls"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _validate_file(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일명이 없습니다.",
        )
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 파일 형식입니다. (.xlsx, .xls만 허용)",
        )


@router.post("/preview", response_model=ApiResponse[UploadPreview])
async def upload_preview(
    current_user: EditorUser,
    file: UploadFile = File(...),
):
    """엑셀 파일을 파싱하여 미리보기 데이터를 반환합니다."""
    _validate_file(file)
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일 크기가 10MB를 초과합니다.",
        )

    try:
        parsed = upload_service.parse_excel(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일을 파싱할 수 없습니다. 올바른 형식인지 확인해주세요.",
        )

    if not parsed.rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일에 유효한 데이터가 없습니다.",
        )

    preview = upload_service.build_preview(parsed)
    return ApiResponse(success=True, data=preview)


@router.post("/diff", response_model=ApiResponse[DiffResult])
async def upload_diff(
    db: DbSession,
    current_user: EditorUser,
    file: UploadFile = File(...),
):
    """엑셀 파일을 파싱하여 기존 DB와 비교한 diff를 반환합니다."""
    _validate_file(file)
    file_bytes = await file.read()

    try:
        parsed = upload_service.parse_excel(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일을 파싱할 수 없습니다.",
        )

    diff = await upload_service.diff_tasks(db, parsed)
    return ApiResponse(success=True, data=diff)


@router.post("/confirm", response_model=ApiResponse[UpsertResult])
async def upload_confirm(
    db: DbSession,
    current_user: EditorUser,
    file: UploadFile = File(...),
):
    """엑셀 파일을 파싱하여 DB에 upsert합니다."""
    _validate_file(file)
    file_bytes = await file.read()

    try:
        parsed = upload_service.parse_excel(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일을 파싱할 수 없습니다.",
        )

    result = await upload_service.upsert_tasks(db, parsed, current_user.id)
    return ApiResponse(success=True, data=result)
