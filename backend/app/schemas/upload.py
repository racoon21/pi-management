from pydantic import BaseModel


class ExcelRow(BaseModel):
    l1: str
    l2: str
    l3: str
    l4: str


class HierarchyNode(BaseModel):
    name: str
    level: str
    children: list["HierarchyNode"] = []


class UploadPreview(BaseModel):
    rows: list[ExcelRow]
    total_rows: int
    summary: dict
    hierarchy: list[HierarchyNode]


class DiffNode(BaseModel):
    name: str
    level: str
    status: str  # "new" | "existing"
    children: list["DiffNode"] = []


class DiffResult(BaseModel):
    diff_tree: list[DiffNode]
    stats: dict  # {"new": N, "existing": N, "total": N}


class UpsertResult(BaseModel):
    created: int
    skipped: int
    total: int
