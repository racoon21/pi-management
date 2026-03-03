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

    # parent_id + name → Task 매핑
    task_by_parent_name: dict[tuple[UUID | None, str], Task] = {}
    for t in all_tasks:
        task_by_parent_name[(t.parent_id, t.name)] = t

    hierarchy = build_hierarchy(parsed)
    stats = {"new": 0, "existing": 0, "total": 0}

    def diff_node(node: HierarchyNode, parent_id: UUID | None) -> DiffNode:
        existing = task_by_parent_name.get((parent_id, node.name))
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
    """파싱된 데이터를 DB에 upsert."""
    created = 0
    skipped = 0

    # Root 노드 조회/생성
    result = await db.execute(
        select(Task).where(Task.level == "Root", Task.deleted_at.is_(None))
    )
    root = result.scalar_one_or_none()
    if not root:
        root = Task(
            level="Root",
            name="Root",
            organization="",
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(root)
        await db.flush()
        _create_history(db, root, user_id)
        created += 1

    hierarchy = build_hierarchy(parsed)

    for l1_node in hierarchy:
        l1_task, is_new = await _find_or_create(
            db, root.id, "L1", l1_node.name, l1_node.name, user_id
        )
        if is_new:
            created += 1
        else:
            skipped += 1

        for l2_node in l1_node.children:
            l2_task, is_new = await _find_or_create(
                db, l1_task.id, "L2", l2_node.name, l1_node.name, user_id
            )
            if is_new:
                created += 1
            else:
                skipped += 1

            for l3_node in l2_node.children:
                l3_task, is_new = await _find_or_create(
                    db, l2_task.id, "L3", l3_node.name, l1_node.name, user_id
                )
                if is_new:
                    created += 1
                else:
                    skipped += 1

                for l4_node in l3_node.children:
                    _, is_new = await _find_or_create(
                        db, l3_task.id, "L4", l4_node.name, l1_node.name, user_id
                    )
                    if is_new:
                        created += 1
                    else:
                        skipped += 1

    await db.commit()
    return UpsertResult(created=created, skipped=skipped, total=created + skipped)


async def _find_or_create(
    db: AsyncSession,
    parent_id: UUID,
    level: str,
    name: str,
    organization: str,
    user_id: UUID,
) -> tuple[Task, bool]:
    """이름과 부모 ID로 기존 태스크를 찾거나 새로 생성."""
    result = await db.execute(
        select(Task).where(
            Task.parent_id == parent_id,
            Task.name == name,
            Task.deleted_at.is_(None),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing, False

    task = Task(
        parent_id=parent_id,
        level=level,
        name=name,
        organization=organization,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(task)
    await db.flush()
    _create_history(db, task, user_id)
    return task, True


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
