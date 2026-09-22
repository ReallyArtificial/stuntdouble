// The swap verdict: lowest confidence threshold at which routing to the double keeps
// disagreement with the star within budget. A comparison against the star, not against truth.
export function swapVerdict(gated, { maxDisagreement = 0.02, minRows = 20 } = {}) {
  const candidates = gated.filter(g => g.n >= minRows && g.agreement !== null && 1 - g.agreement <= maxDisagreement).sort((a, b) => a.threshold - b.threshold);
  if (!candidates.length) return { qualifies: false, maxDisagreement, minRows, threshold: null, coverage: null, disagreement: null, n: null };
  const best = candidates[0];
  return { qualifies: true, maxDisagreement, minRows, threshold: best.threshold, coverage: best.coverage, disagreement: 1 - best.agreement, n: best.n };
}

// Savings per 1,000 decisions when `coverage` of traffic moves from the star's price to the double's.
export function savings(verdict, starCost, doubleCost) {
  if (!verdict.qualifies || starCost.usdPer1000 === null) return null;
  const doubleUsd = doubleCost?.usdPer1000 ?? 0;
  return verdict.coverage * (starCost.usdPer1000 - doubleUsd);
}
