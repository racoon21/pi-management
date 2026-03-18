import re
from dataclasses import dataclass, field
from io import BytesIO
from uuid import UUID

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, TaskHistory
from app.services.task_service import _task_to_snapshot
from app.schemas.upload import (
    ExcelRow,
    HierarchyNode,
    UploadPreview,
    DiffNode,
    DiffResult,
    UpsertResult,
)


@dataclass
class ParsedExcel:
    rows: list[ExcelRow] = field(default_factory=list)


def parse_excel(file_bytes: bytes) -> ParsedExcel:
    """openpyxl로 엑셀 파싱. 헤더에서 L1~L4 컬럼 자동 감지."""
    wb = load_workbook(filename=BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active

    # 헤더 행에서 L1~L4 컬럼 인덱스 찾기
    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
    col_map: dict[str, int] = {}
    for idx, cell_value in enumerate(header_row):
        if cell_value is None:
            continue
        val = str(cell_value).strip().upper()
        if val in ("L1", "L2", "L3", "L4"):
            col_map[val] = idx

    if not all(k in col_map for k in ("L1", "L2", "L3", "L4")):
        raise ValueError(
            f"엑셀 헤더에서 L1~L4 컬럼을 찾을 수 없습니다. 발견된 컬럼: {list(col_map.keys())}"
        )

    rows: list[ExcelRow] = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        l1 = row[col_map["L1"]] if col_map["L1"] < len(row) else None
        l2 = row[col_map["L2"]] if col_map["L2"] < len(row) else None
        l3 = row[col_map["L3"]] if col_map["L3"] < len(row) else None
        l4 = row[col_map["L4"]] if col_map["L4"] < len(row) else None

        # 빈 행 건너뛰기 (L4가 없으면 유효하지 않은 행)
        if not l4 or not str(l4).strip():
            continue

        rows.append(
            ExcelRow(
                l1=str(l1).strip() if l1 else "",
                l2=str(l2).strip() if l2 else "",
                l3=str(l3).strip() if l3 else "",
                l4=str(l4).strip() if l4 else "",
            )
        )

    wb.close()
    return ParsedExcel(rows=rows)


def build_hierarchy(parsed: ParsedExcel) -> list[HierarchyNode]:
    """파싱된 데이터를 계층 트리로 변환."""
    tree: dict[str, dict] = {}  # l1 -> {name, children: {l2 -> ...}}

    for row in parsed.rows:
        if row.l1 not in tree:
            tree[row.l1] = {}
        l2_map = tree[row.l1]

        if row.l2 not in l2_map:
            l2_map[row.l2] = {}
        l3_map = l2_map[row.l2]

        if row.l3 not in l3_map:
            l3_map[row.l3] = []
        l4_list: list[str] = l3_map[row.l3]

        if row.l4 not in l4_list:
            l4_list.append(row.l4)

    # dict → HierarchyNode 트리
    result: list[HierarchyNode] = []
    for l1_name, l2_map in tree.items():
        l2_nodes: list[HierarchyNode] = []
        for l2_name, l3_map in l2_map.items():
            l3_nodes: list[HierarchyNode] = []
            for l3_name, l4_list in l3_map.items():
                l4_nodes = [HierarchyNode(name=n, level="L4") for n in l4_list]
                l3_nodes.append(HierarchyNode(name=l3_name, level="L3", children=l4_nodes))
            l2_nodes.append(HierarchyNode(name=l2_name, level="L2", children=l3_nodes))
        result.append(HierarchyNode(name=l1_name, level="L1", children=l2_nodes))

    return result


def build_preview(parsed: ParsedExcel) -> UploadPreview:
    """미리보기 데이터 생성."""
    unique_l1 = set()
    unique_l2 = set()
    unique_l3 = set()
    unique_l4 = set()

    for row in parsed.rows:
        unique_l1.add(row.l1)
        unique_l2.add((row.l1, row.l2))
        unique_l3.add((row.l1, row.l2, row.l3))
        unique_l4.add((row.l1, row.l2, row.l3, row.l4))

    return UploadPreview(
        rows=parsed.rows[:10],
        total_rows=len(parsed.rows),
        summary={
            "l1_count": len(unique_l1),
            "l2_count": len(unique_l2),
            "l3_count": len(unique_l3),
            "l4_count": len(unique_l4),
        },
        hierarchy=build_hierarchy(parsed),
    )


async def diff_tasks(db: AsyncSession, parsed: ParsedExcel) -> DiffResult:
    """파싱된 데이터를 기존 DB와 비교하여 diff 트리 반환."""
    # Root 노드 조회
    result = await db.execute(
        select(Task).where(Task.level == "Root", Task.deleted_at.is_(None))
    )
    root = result.scalar_one_or_none()

    # 기존 태스크를 (level, parent_id, name)으로 인덱싱
    all_tasks_result = await db.execute(
        select(Task).where(Task.deleted_at.is_(None))
    )
    all_tasks = list(all_tasks_result.scalars().all())

    # [IMP-08] parent_id + normalized_name → Task 매핑 (띄어쓰기 제외 비교)
    task_by_parent_name: dict[tuple[UUID | None, str], Task] = {}
    for t in all_tasks:
        normalized = _normalize_name(t.name)
        task_by_parent_name[(t.parent_id, normalized)] = t

    hierarchy = build_hierarchy(parsed)
    stats = {"new": 0, "existing": 0, "total": 0}

    def diff_node(node: HierarchyNode, parent_id: UUID | None) -> DiffNode:
        existing = task_by_parent_name.get((parent_id, _normalize_name(node.name)))
        status = "existing" if existing else "new"
        stats[status] += 1
        stats["total"] += 1

        children: list[DiffNode] = []
        child_parent_id = existing.id if existing else None
        for child in node.children:
            children.append(diff_node(child, child_parent_id))

        return DiffNode(
            name=node.name,
            level=node.level,
            status=status,
            children=children,
        )

    diff_tree: list[DiffNode] = []
    root_id = root.id if root else None
    for l1_node in hierarchy:
        diff_tree.append(diff_node(l1_node, root_id))

    return DiffResult(diff_tree=diff_tree, stats=stats)


async def upsert_tasks(
    db: AsyncSession, parsed: ParsedExcel, user_id: UUID
) -> UpsertResult:
    """파싱된 데이터를 DB에 upsert (Bulk 최적화).

    기존: 노드마다 SELECT + INSERT + flush → ~2,500 DB 왕복
    개선: 사전 인덱싱 1회 + 레벨별 bulk flush 4회 → ~6 DB 왕복
    """
    created = 0
    skipped = 0

    # ── 1. 기존 태스크 전체 로드 + 인메모리 인덱스 (1 query) ──
    all_result = await db.execute(
        select(Task).where(Task.deleted_at.is_(None))
    )
    all_tasks = list(all_result.scalars().all())

    # (parent_id, normalized_name) → Task
    index: dict[tuple[UUID | None, str], Task] = {}
    for t in all_tasks:
        index[(t.parent_id, _normalize_name(t.name))] = t

    # ── 2. Root 노드 조회/생성 ──
    root = next((t for t in all_tasks if t.level == "Root"), None)
    if not root:
        root = Task(
            level="Root", name="Root", organization="",
            created_by=user_id, updated_by=user_id,
        )
        db.add(root)
        await db.flush()
        _create_history(db, root, user_id)
        created += 1

    hierarchy = build_hierarchy(parsed)

    # ── 3. 계층 순회: 인메모리 매칭 + 신규 태스크 수집 ──
    new_tasks: list[Task] = []

    def _lookup_or_new(
        parent: Task, level: str, name: str, organization: str,
    ) -> Task:
        nonlocal created, skipped
        key = (parent.id, _normalize_name(name))
        existing = index.get(key)
        if existing:
            skipped += 1
            return existing
        task = Task(
            parent_id=parent.id, level=level, name=name,
            organization=organization,
            created_by=user_id, updated_by=user_id,
        )
        new_tasks.append(task)
        created += 1
        return task

    # L1 수집
    l1_map: list[tuple[Task, HierarchyNode]] = []
    for l1_node in hierarchy:
        l1_task = _lookup_or_new(root, "L1", l1_node.name, l1_node.name)
        l1_map.append((l1_task, l1_node))

    # L1 flush → ID 확정, 인덱스 갱신
    await _flush_new(db, new_tasks, index)

    # L2 수집
    l2_map: list[tuple[Task, HierarchyNode, str]] = []
    for l1_task, l1_node in l1_map:
        for l2_node in l1_node.children:
            l2_task = _lookup_or_new(l1_task, "L2", l2_node.name, l1_node.name)
            l2_map.append((l2_task, l2_node, l1_node.name))

    await _flush_new(db, new_tasks, index)

    # L3 수집
    l3_map: list[tuple[Task, HierarchyNode, str]] = []
    for l2_task, l2_node, org in l2_map:
        for l3_node in l2_node.children:
            l3_task = _lookup_or_new(l2_task, "L3", l3_node.name, org)
            l3_map.append((l3_task, l3_node, org))

    await _flush_new(db, new_tasks, index)

    # L4 수집
    for l3_task, l3_node, org in l3_map:
        for l4_node in l3_node.children:
            _lookup_or_new(l3_task, "L4", l4_node.name, org)

    await _flush_new(db, new_tasks, index)

    # ── 4. 커밋 ──
    await db.commit()
    return UpsertResult(created=created, skipped=skipped, total=created + skipped)


async def _flush_new(
    db: AsyncSession,
    pending: list[Task],
    index: dict[tuple[UUID | None, str], Task],
) -> None:
    """pending 리스트의 신규 태스크를 bulk flush + 히스토리 생성 + 인덱스 갱신."""
    if not pending:
        return
    batch = list(pending)
    pending.clear()
    db.add_all(batch)
    await db.flush()  # 1회 flush로 모든 ID 확정
    for task in batch:
        _create_history(db, task, task.created_by)
        index[(task.parent_id, _normalize_name(task.name))] = task


def _create_history(db: AsyncSession, task: Task, user_id: UUID) -> None:
    """태스크 생성 히스토리 기록."""
    history = TaskHistory(
        task_id=task.id,
        snapshot=_task_to_snapshot(task),
        version=1,
        change_type="CREATE",
        changed_by=user_id,
    )
    db.add(history)


def _normalize_name(name: str) -> str:
    """[IMP-08] 비교용 정규화: 모든 공백 제거"""
    return re.sub(r"\s+", "", name.strip())
