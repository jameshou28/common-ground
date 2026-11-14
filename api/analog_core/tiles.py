import math
import re

# tile id: earth:g:i:j below 80 deg, moon:ps:s:ix:iy on the polar grid above it
RADIUS_M = {"earth": 6_371_000.0, "moon": 1_737_400.0, "mars": 3_389_500.0}
STEP_M = 4000.0 # 4 km tiles
POLAR_LAT = 80.0
TILE_RE = re.compile(r"^(earth|moon|mars):(g:-?\d{1,5}:-?\d{1,5}|ps:[ns]:-?\d{1,4}:-?\d{1,4})$")


def _round(x: float) -> int:
    return math.floor(x + 0.5) # half up like js, python round() is half to even


def _wrap(lon: float) -> float:
    return (lon + 180.0) % 360.0 - 180.0


def tile_id(world: str, lat: float, lon: float) -> str:
    R = RADIUS_M[world]
    if abs(lat) < POLAR_LAT:
        dphi = math.degrees(STEP_M / R)
        i = _round(lat / dphi)
        dlam = dphi / math.cos(math.radians(i * dphi)) # lon step gets wider toward the poles
        return f"{world}:g:{i}:{_round(_wrap(lon) / dlam)}"

    # POLAR:
    south = lat < 0
    rho = 2 * R * math.tan(math.pi / 4 - math.radians(abs(lat)) / 2)
    x = rho * math.sin(math.radians(lon))
    y = (1 if south else -1) * rho * math.cos(math.radians(lon))
    return f"{world}:ps:{'s' if south else 'n'}:{_round(x / STEP_M)}:{_round(y / STEP_M)}"


def parse(tid: str) -> tuple[str, str, list[str]]:
    if not TILE_RE.match(tid):
        raise ValueError(f"bad tile id: {tid}")
    world, kind, *rest = tid.split(":")
    return world, kind, rest


def tile_center(tid: str) -> tuple[str, float, float]:
    world, kind, rest = parse(tid)
    R = RADIUS_M[world]
    if kind == "g":
        i, j = int(rest[0]), int(rest[1])
        dphi = math.degrees(STEP_M / R)
        lat = i * dphi
        if abs(lat) >= 90:
            raise ValueError(f"tile off the planet: {tid}")
        return world, lat, _wrap(j * dphi / math.cos(math.radians(lat)))

    south = rest[0] == "s"
    x, y = int(rest[1]) * STEP_M, int(rest[2]) * STEP_M
    lat = 90.0 - math.degrees(2 * math.atan(math.hypot(x, y) / (2 * R)))
    lon = math.degrees(math.atan2(x, y if south else -y))
    return world, (-lat if south else lat), lon
