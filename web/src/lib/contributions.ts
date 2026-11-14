import type { BlockResult, Contribution } from "./api";

export type Group = { name: string; rows: Contribution[]; sum: number };

const GROUP_LABEL: Record<string, string> = {
  shape: "Terrain shape",
  slope: "Slope",
  roughness: "Roughness",
  light: "Light at the target's Sun",
  surface: "Surface and climate",
};
export const groupLabel = (g: string) => GROUP_LABEL[g] ?? g.charAt(0).toUpperCase() + g.slice(1);

// groups in the order the api lists them, rows largest first
export function groupContributions(cs: Contribution[]): Group[] {
  const out: Group[] = [];
  for (const c of cs) {
    let g = out.find((x) => x.name === c.group);
    if (!g) out.push((g = { name: c.group, rows: [], sum: 0 }));
    g.rows.push(c);
    g.sum += c.contribution;
  }
  for (const g of out) g.rows.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return out;
}

export const logit = (score: number) => Math.log(score / (100 - score));

// bias plus every bar, which the model turns into the score
export function totals(r: Pick<BlockResult, "bias" | "contributions" | "score">) {
  const bars = r.contributions.reduce((s, c) => s + c.contribution, 0);
  const total = r.bias + bars;
  // zero when the bars add up, a score of exactly 0 or 100 has no finite logit to compare
  const gap = r.score > 0 && r.score < 100 ? total - logit(r.score) : 0;
  return { bars, total, gap };
}
