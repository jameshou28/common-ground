from typing import Literal

from pydantic import BaseModel, Field

from analog_core.tiles import TILE_RE

# the contract, web types get generated from /openapi.json
TileId = Field(pattern=TILE_RE.pattern, examples=["earth:g:974:-2527"])


class ScoreRequest(BaseModel):
    tile_id: str = TileId
    target_id: str = Field(examples=["connecting_ridge"])


class MatchRequest(BaseModel):
    tile_id: str = TileId


class LatLon(BaseModel):
    lat: float
    lon: float


class Range(BaseModel):
    low: float
    high: float


class Contribution(BaseModel):
    key: str
    label: str
    group: str
    value: float
    target_value: float
    distance: float
    percentile: float | None = None
    contribution: float # logit units, bias + sum(contribution) == logit(score / 100)
    unit: str


class Point(BaseModel):
    id: str
    x_m: float # east of the block centre
    y_m: float # north of the block centre
    effect: Literal["help", "hurt"]
    landform: str
    local: dict[str, float]
    reason: str


class BlockResult(BaseModel):
    tile_id: str
    world: Literal["earth", "moon", "mars"]
    center: LatLon
    size_m: int = 4000
    dem_source: str
    resolution_m: float
    confidence: Literal["normal", "lower", "coarse"]
    measured_share: float | None = None
    target_id: str
    model_version: str
    cached: bool
    score: float
    score_range: Range
    percentile: float | None = None
    typicality: float | None = None
    typicality_percentile: float | None = None
    physics_score: float
    bias: float
    contributions: list[Contribution]
    nearest_analog: dict | None = None # victors shape, comes with the real model
    ood: bool = False
    points: list[Point]
    grid_url: str


# MATCH: proposed shape from victors class design, not agreed yet

class MatchedBlock(BaseModel):
    name: str # nearest iau gazetteer name
    world: Literal["moon", "mars"]
    center: LatLon
    score: float


class ClassScore(BaseModel):
    class_id: str # like crater_rim
    label: str
    score: float # 0 to 100, calibrated against the class's own members
    best: list[MatchedBlock] = []


class ContextScores(BaseModel):
    world: Literal["moon", "mars"]
    context: str # big region like basin
    classes: list[ClassScore]


class MatchResult(BaseModel):
    tile_id: str
    center: LatLon
    model_version: str
    cached: bool
    contexts: list[ContextScores]
    gate: dict[str, float] # earth side terms, vegetation water snow built-up
    confidence: Literal["normal", "lower", "coarse"]
    grid_url: str
