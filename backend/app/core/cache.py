import time
from typing import Any


class TaskCache:
    """인메모리 태스크 그래프 캐시 (TTL 기반).

    그래프 데이터는 변경 빈도가 낮으므로 (생성/수정/삭제 시에만 변경)
    DB 쿼리를 줄여 응답 속도를 개선한다.
    워커 2개 환경에서 워커별 독립 캐시이나 TTL이 짧아 불일치 무시 가능.
    """

    def __init__(self, ttl: int = 60):
        self._data: list[Any] | None = None
        self._timestamp: float = 0
        self._ttl = ttl

    def get(self) -> list[Any] | None:
        """TTL 이내면 캐시 데이터 반환, 만료 시 None."""
        if self._data is not None and (time.time() - self._timestamp) < self._ttl:
            return self._data
        return None

    def set(self, data: list[Any]) -> None:
        """DB 조회 결과를 캐시에 저장."""
        self._data = data
        self._timestamp = time.time()

    def invalidate(self) -> None:
        """데이터 변경 시 즉시 캐시 무효화."""
        self._data = None
        self._timestamp = 0


task_cache = TaskCache(ttl=60)
