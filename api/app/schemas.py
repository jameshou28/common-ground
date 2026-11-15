from pydantic import BaseModel, ConfigDict, Field

from analog_core.tiles import TILE_RE

# the contract, web types get generated from /openapi.json
# shapes follow victors click_to_score_contract.md, extra fields from newer models pass through
TileId = Field(pattern=TILE_RE.pattern, examples=["earth:g:974:-2527"])


class Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class ScoreRequest(BaseModel):
    tile_id: str = TileId


class LatLon(BaseModel):
    lat: float
    lon: float


class Conditions(Loose):
    score: float # 0 to 100, the earth side, same for both tabs
    terms: dict[str, float] # logit points, <= 0 except bare
    discount: float | None = None # v1.1, overall = landscape * discount


class Site(Loose):
    index: int # library row, GET /library/{index} draws it
    name: str
    tag: str
    region: str
    lat: float
    lon: float
    href: str
    pair_score: float
    contributions: dict[str, float] # logit points, keys change between models so dont hard-code them
    cell_cost: list[list[float]] # 8 x 8, row 0 = north
    partner: list[int] # matched library cell of each earth cell


class ScaleScore(Loose):
    score: float


class Region(Loose):
    region: str # like moon:maria
    title: str
    score: float # landscape, 0 to 100
    overall: float # landscape and conditions together
    scales: dict[str, ScaleScore]
    best: list[Site]


class World(Loose):
    regions: list[Region] # best first
    best_region: str
    landscape_score: float
    overall: float
    best_match: Site


class ScoreResult(Loose):
    tile_id: str
    center: LatLon
    size_m: int = 4000
    model_version: str
    cached: bool
    ood: bool # terrain unlike anything the model was fitted on
    conditions: Conditions
    env: dict[str, float | None] # worldcover shares 0 to 1, precip mm per year
    block: dict[str, float]
    worlds: dict[str, World] # moon and mars, the two tabs
    grid_url: str


class LibraryBlock(BaseModel):
    index: int
    world: str
    model_version: str
    grid_url: str
