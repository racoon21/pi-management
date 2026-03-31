from pydantic import BaseModel


class ExcelRow(BaseModel):
    l1: str
    l2: str
    l3: str
    l4: str
    l3_related_team: str = ""
    l4_related_team: str = ""
    organization_type: str = ""
    organization_name: str = ""
    manager_name: str = ""
    manager_id: str = ""
    keywords: str = ""
    is_ai_utilized: str = ""


class HierarchyNode(BaseModel):
    name: str
    level: str
    related_team: list[str] | None = None
    organization_type: str | None = None
    organization_name: str | None = None
    manager_name: str | None = None
    manager_id: str | None = None
    keywords: list[str] | None = None
    is_ai_utilized: bool = False
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
