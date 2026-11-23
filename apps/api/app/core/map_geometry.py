from __future__ import annotations

from typing import Iterable

Blocker = tuple[tuple[float, float, float], tuple[float, float, float]]


def _box(center: tuple[float, float, float], size: tuple[float, float, float]) -> Blocker:
    half = tuple(v / 2 for v in size)
    return (
        (center[0] - half[0], center[1] - half[1], center[2] - half[2]),
        (center[0] + half[0], center[1] + half[1], center[2] + half[2]),
    )


MARKET_BLOCKERS: tuple[Blocker, ...] = (
    _box((-15, 2, -10), (1, 4, 20)),
    _box((-5, 2, -20), (20, 4, 1)),
    _box((10, 2, 5), (1, 4, 18)),
    _box((18, 2, 14), (16, 4, 1)),
    _box((26, 2, 0), (1, 4, 28)),
    _box((-30, 2, 30), (12, 4, 1)),
    _box((-10, 0.75, 10), (1.5, 1.5, 1.5)),
    _box((5, 1, -8), (2, 2, 2)),
    _box((15, 0.6, -12), (1.2, 1.2, 1.2)),
    _box((22, 1, 20), (2, 2, 2)),
    _box((-20, 0.75, -25), (1.5, 1.5, 1.5)),
    _box((12, 1.25, 28), (2.5, 2.5, 2.5)),
    _box((-28, 0.8, -5), (1.6, 1.6, 1.6)),
    _box((32, 0.6, 10), (1.2, 1.2, 1.2)),
    _box((-2, 1.2, -2), (3, 2.4, 1.2)),
    _box((6, 1.2, 14), (3, 2.4, 1.2)),
    _box((-18, 1, 18), (2.2, 2, 2.2)),
    _box((0, 0.75, -5), (4, 0.4, 8)),
    _box((0, 1.5, -11), (6, 0.5, 4)),
    _box((20, 1.45, -5), (6, 0.3, 6)),
)

GENERIC_BLOCKERS: tuple[Blocker, ...] = (
    _box((-15, 2, -10), (1, 4, 20)),
    _box((12, 2, 5), (1, 4, 18)),
    _box((5, 1, -8), (2, 2, 2)),
    _box((-5, 1, 12), (3, 2, 3)),
    _box((20, 1, -12), (4, 2, 4)),
)

BLOCKERS: dict[str, tuple[Blocker, ...]] = {
    "market": MARKET_BLOCKERS,
    "warehouse": GENERIC_BLOCKERS,
    "rooftops": GENERIC_BLOCKERS,
    "garden": GENERIC_BLOCKERS,
    "arcade": GENERIC_BLOCKERS,
}


def blockers_for(map_id: str | None) -> Iterable[Blocker]:
    return BLOCKERS.get(map_id or "market", GENERIC_BLOCKERS)


def _segment_intersects_box(a: tuple[float, float, float], b: tuple[float, float, float], box: Blocker) -> bool:
    lo, hi = box
    t0, t1 = 0.0, 1.0
    for axis in range(3):
        d = b[axis] - a[axis]
        if abs(d) < 1e-8:
            if a[axis] < lo[axis] or a[axis] > hi[axis]:
                return False
            continue
        inv = 1.0 / d
        near = (lo[axis] - a[axis]) * inv
        far = (hi[axis] - a[axis]) * inv
        if near > far:
            near, far = far, near
        t0 = max(t0, near)
        t1 = min(t1, far)
        if t0 > t1:
            return False
    return t1 > 0.02 and t0 < 0.98


def has_line_of_sight(map_id: str | None, a: tuple[float, float, float], b: tuple[float, float, float]) -> bool:
    for box in blockers_for(map_id):
        if _segment_intersects_box(a, b, box):
            return False
    return True
