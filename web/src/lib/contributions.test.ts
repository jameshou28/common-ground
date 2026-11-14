import { describe, expect, it } from "vitest";
import type { Contribution } from "./api";
import { groupContributions, logit, radarRows, totals } from "./contributions";

const c = (key: string, group: string, contribution: number): Contribution => ({ key, label: key, group, value: 1, target_value: 2, distance: 1, contribution, unit: "" });

// meteor crater against connecting ridge, from the api on nov 14
const meteor = {
  bias: 2,
  score: 11.515000223168194,
  contributions: [
    c("relief_m", "shape", -0.8218995706560903),
    c("slope_med_deg", "slope", -1.338056996418817),
    c("slope_p90_deg", "slope", -0.697531804065547),
    c("rms_150m", "roughness", -0.12216667302037008),
    c("rms_1500m", "roughness", -0.07749901832775535),
    c("hypsometric", "shape", -0.28189518871307373),
    c("shadow", "light", -0.7001332397460938),
  ],
};

describe("contributions", () => {
  it("bias plus the bars is the logit of the score", () => {
    const t = totals(meteor);
    expect(t.total).toBeCloseTo(logit(meteor.score), 6);
    expect(Math.abs(t.gap)).toBeLessThan(1e-6);
  });

  it("groups keep the api order, rows go largest first, sums add up", () => {
    const groups = groupContributions(meteor.contributions);
    expect(groups.map((g) => g.name)).toEqual(["shape", "slope", "roughness", "light"]);
    expect(groups[1].rows.map((r) => r.key)).toEqual(["slope_med_deg", "slope_p90_deg"]);
    expect(groups.reduce((s, g) => s + g.sum, 0)).toBeCloseTo(totals(meteor).bars, 9);
  });

  it("radar spokes are the block's values over the target's, capped at 1.5", () => {
    const rows = radarRows([
      { ...c("relief_m", "shape", 0), value: 138, target_value: 542 },
      { ...c("rms_150m", "roughness", 0), value: 4, target_value: 1 },
      { ...c("hypsometric", "shape", 0), value: 0.6, target_value: 0.7 },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["relief_m", "rms_150m"]);
    expect(rows[0].ratio).toBeCloseTo(138 / 542, 9);
    expect(rows[1].shown).toBe(1.5);
  });
});
