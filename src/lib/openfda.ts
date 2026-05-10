// Shared openFDA types + PRR/ROR disproportionality math.

export type CountBucket = { term: string; count: number };
export type CountResponse = {
  meta: { results: { total: number } };
  results: CountBucket[];
};
export type SearchMeta = { meta: { results: { total: number; skip: number; limit: number } } };

export type Signal = {
  reaction: string;
  a: number;
  b: number;
  c: number;
  d: number;
  prr: number;
  prrLow: number;
  prrHigh: number;
  ror: number;
  rorLow: number;
  rorHigh: number;
  chiSq: number;
  level: "strong" | "moderate" | "weak" | "none";
};

function classify(prrLow: number, a: number, chi: number): Signal["level"] {
  if (prrLow >= 2 && a >= 3 && chi >= 4) return "strong";
  if (prrLow >= 1.5 && a >= 3) return "moderate";
  if (prrLow >= 1) return "weak";
  return "none";
}

/** Compute PRR/ROR/χ² for top reactions of a drug given background counts. */
export function computeSignals(
  topForDrug: CountBucket[],
  background: CountBucket[],
  drugTotal: number,
  grandTotal: number,
): Signal[] {
  const bgMap = new Map(background.map((b) => [b.term, b.count]));
  return topForDrug
    .map((r): Signal | null => {
      const a = r.count;
      const aPlusB = drugTotal;
      const aPlusC = bgMap.get(r.term);
      if (!aPlusC || aPlusB <= 0 || grandTotal <= 0) return null;
      const b = Math.max(aPlusB - a, 0);
      const c = Math.max(aPlusC - a, 0);
      const d = Math.max(grandTotal - a - b - c, 0);
      if (a === 0 || b === 0 || c === 0 || d === 0) return null;
      const prr = (a / (a + b)) / (c / (c + d));
      const ror = (a * d) / (b * c);
      const seLogPrr = Math.sqrt(1 / a - 1 / (a + b) + 1 / c - 1 / (c + d));
      const seLogRor = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
      const prrLow = prr * Math.exp(-1.96 * seLogPrr);
      const prrHigh = prr * Math.exp(1.96 * seLogPrr);
      const rorLow = ror * Math.exp(-1.96 * seLogRor);
      const rorHigh = ror * Math.exp(1.96 * seLogRor);
      const expected = ((a + b) * (a + c)) / (a + b + c + d);
      const chiSq = ((a - expected) ** 2) / expected;
      return {
        reaction: r.term,
        a, b, c, d,
        prr: round(prr), prrLow: round(prrLow), prrHigh: round(prrHigh),
        ror: round(ror), rorLow: round(rorLow), rorHigh: round(rorHigh),
        chiSq: round(chiSq, 1),
        level: classify(prrLow, a, chiSq),
      };
    })
    .filter((s): s is Signal => s !== null)
    .sort((a, b) => b.prr - a.prr);
}

function round(n: number, dp = 2) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export const DRUG_PRESETS = [
  "OZEMPIC", "HUMIRA", "METFORMIN", "LIPITOR", "WARFARIN",
  "XARELTO", "ELIQUIS", "KEYTRUDA", "TRAMADOL", "PREDNISONE",
];