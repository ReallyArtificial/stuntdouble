// Pure functions over records. Definitions live in docs/metrics.md; keep both in sync.
import { answerKeys } from './contract.mjs';

export const THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95];

// Probability vector over answerKeys(question), in key order.
export function probabilities(answer, question) {
  if (question.type === 'noul') return [answer.noul, 1 - answer.noul];
  return answerKeys(question).map(k => answer.probabilities[k]);
}

export function selected(answer, question, { noulThreshold = 0.5 } = {}) {
  if (question.type === 'noul') return answer.noul >= noulThreshold ? 'yes' : 'no';
  if (question.type === 'choice') return answer.choice;
  return String(Math.round(answer.score));
}

export function confidence(answer, question) {
  if (question.type === 'noul') return Math.max(answer.noul, 1 - answer.noul);
  if (typeof answer.confidence === 'number') return answer.confidence;
  return Math.max(...probabilities(answer, question));
}

// A label for one question is either a selected key (string / number / boolean) or
// { selected, distribution } where distribution maps keys to probabilities.
export function labelSelected(label, question) {
  if (label === null || label === undefined) return null;
  const raw = typeof label === 'object' && !Array.isArray(label) ? label.selected : label;
  if (raw === null || raw === undefined) return null;
  if (question.type === 'noul') return typeof raw === 'boolean' ? (raw ? 'yes' : 'no') : (['yes', 'true', '1'].includes(String(raw).toLowerCase()) ? 'yes' : 'no');
  return String(raw);
}

export function labelDistribution(label, question) {
  if (label && typeof label === 'object' && label.distribution) return answerKeys(question).map(k => label.distribution[k] ?? 0);
  const sel = labelSelected(label, question);
  return sel === null ? null : answerKeys(question).map(k => (k === sel ? 1 : 0));
}

// One row per (record, question, double). Rows with a double error carry error and no selections.
export function pairs(records, doubleName, options = {}) {
  const rows = [];
  for (const record of records) {
    if (!record.star?.answers) continue;
    const d = record.doubles?.[doubleName];
    if (!d) continue;
    for (const [qid, question] of Object.entries(record.request.questions)) {
      const starAnswer = record.star.answers[qid];
      const label = record.label && typeof record.label === 'object' ? record.label[qid] ?? null : null;
      const row = {
        id: record.id, qid, type: question.type, question, label,
        starSelected: selected(starAnswer, question, options), starConfidence: confidence(starAnswer, question), starProbabilities: probabilities(starAnswer, question),
        labelSelected: labelSelected(label, question), labelDistribution: labelDistribution(label, question),
        error: d.error ?? null, doubleSelected: null, doubleConfidence: null, doubleProbabilities: null,
        starElapsedMs: record.star.elapsedMs, doubleElapsedMs: d.elapsedMs,
        starScore: question.type === 'score' ? starAnswer.score : null, doubleScore: null,
      };
      if (!d.error && d.answers?.[qid]) {
        const a = d.answers[qid];
        row.doubleSelected = selected(a, question, options);
        row.doubleConfidence = confidence(a, question);
        row.doubleProbabilities = probabilities(a, question);
        row.doubleScore = question.type === 'score' ? a.score : null;
      }
      rows.push(row);
    }
  }
  return rows;
}

const ok = (rows) => rows.filter(r => !r.error && r.doubleSelected !== null);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function agreement(rows) {
  const valid = ok(rows);
  return { n: valid.length, agreement: valid.length ? valid.filter(r => r.doubleSelected === r.starSelected).length / valid.length : null };
}

export function agreementWithLabel(rows, side = 'double') {
  const valid = ok(rows).filter(r => r.labelSelected !== null);
  const key = side === 'double' ? 'doubleSelected' : 'starSelected';
  return { n: valid.length, accuracy: valid.length ? valid.filter(r => r[key] === r.labelSelected).length / valid.length : null };
}

// For each threshold: agreement among rows where the double's confidence clears it, and
// the share of all valid rows that clear it (coverage).
export function gatedAgreement(rows, thresholds = THRESHOLDS) {
  const valid = ok(rows);
  return thresholds.map(t => {
    const gated = valid.filter(r => r.doubleConfidence >= t);
    return { threshold: t, n: gated.length, coverage: valid.length ? gated.length / valid.length : null, agreement: gated.length ? gated.filter(r => r.doubleSelected === r.starSelected).length / gated.length : null };
  });
}

export function scoreTolerance(rows, tolerance = 0.5) {
  const valid = ok(rows).filter(r => r.type === 'score');
  return { n: valid.length, withinTolerance: valid.length ? valid.filter(r => Math.abs(r.starScore - r.doubleScore) <= tolerance).length / valid.length : null, meanAbsoluteDifference: mean(valid.map(r => Math.abs(r.starScore - r.doubleScore))) };
}

export function brier(rows, side = 'double') {
  const valid = ok(rows).filter(r => r.labelDistribution);
  const key = side === 'double' ? 'doubleProbabilities' : 'starProbabilities';
  return { n: valid.length, brier: mean(valid.map(r => r[key].reduce((s, p, i) => s + (p - r.labelDistribution[i]) ** 2, 0))) };
}

export function ece(rows, side = 'double', bins = 10) {
  const valid = ok(rows).filter(r => r.labelSelected !== null);
  const conf = side === 'double' ? 'doubleConfidence' : 'starConfidence', sel = side === 'double' ? 'doubleSelected' : 'starSelected';
  const buckets = Array.from({ length: bins }, () => ({ n: 0, conf: 0, correct: 0 }));
  for (const r of valid) {
    const b = buckets[Math.min(bins - 1, Math.floor(r[conf] * bins))];
    b.n++; b.conf += r[conf]; b.correct += r[sel] === r.labelSelected ? 1 : 0;
  }
  return { n: valid.length, ece: valid.length ? buckets.reduce((s, b) => s + (b.n ? (b.n / valid.length) * Math.abs(b.conf / b.n - b.correct / b.n) : 0), 0) : null };
}

// Share of labeled decisions accepted in confidence order before the accepted set's error
// exceeds the budget. Equal-confidence rows are admitted as a whole group or not at all.
export function coverageAtError(rows, side = 'double', budget = 0.05) {
  const valid = ok(rows).filter(r => r.labelSelected !== null);
  const conf = side === 'double' ? 'doubleConfidence' : 'starConfidence', sel = side === 'double' ? 'doubleSelected' : 'starSelected';
  const sorted = [...valid].sort((a, b) => b[conf] - a[conf]);
  let accepted = 0, wrong = 0, best = 0;
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j < sorted.length && sorted[j][conf] === sorted[i][conf]) { accepted++; if (sorted[j][sel] !== sorted[j].labelSelected) wrong++; j++; }
    if (wrong / accepted <= budget) best = accepted; else break;
    i = j;
  }
  return { n: valid.length, budget, coverage: valid.length ? best / valid.length : null };
}

export function percentile(values, p) {
  const xs = values.filter(v => typeof v === 'number').sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)];
}

export function latency(records, name) {
  const values = records.map(r => (name === r.star?.name ? r.star?.elapsedMs : r.doubles?.[name]?.elapsedMs)).filter(v => typeof v === 'number');
  return { n: values.length, p50: percentile(values, 50), p95: percentile(values, 95), mean: mean(values) };
}

export function availability(records, name) {
  const calls = records.map(r => r.doubles?.[name]).filter(Boolean);
  return { n: calls.length, available: calls.length ? calls.filter(c => !c.error).length / calls.length : null };
}

// USD per 1,000 decisions, counting only responses whose model matches the priced one.
export function cost(records, name, { pricePerMillionInput, model } = {}) {
  if (!pricePerMillionInput) return { n: 0, usdPer1000: null, priced: 0 };
  const calls = records.map(r => (name === r.star?.name ? r.star : r.doubles?.[name])).filter(c => c && !c.error);
  const priced = calls.filter(c => (!model || c.model === model) && Number.isFinite(c.usage?.input_tokens));
  const usd = priced.reduce((s, c) => s + (c.usage.input_tokens * pricePerMillionInput) / 1e6, 0);
  return { n: calls.length, priced: priced.length, usdPer1000: priced.length ? (usd / priced.length) * 1000 : null, meanInputTokens: mean(priced.map(c => c.usage.input_tokens)) };
}

// Records produced by `suite run` on a policy suite carry record.policy = { star: decision, doubles: { name: decision } }.
export function policyAgreement(records, doubleName) {
  const rows = records.filter(r => r.policy?.star && r.policy?.doubles?.[doubleName] && !r.policy.doubles[doubleName].error);
  const same = (a, b) => a.action === b.action && JSON.stringify(a.details ?? null) === JSON.stringify(b.details ?? null);
  return { n: rows.length, agreement: rows.length ? rows.filter(r => same(r.policy.star, r.policy.doubles[doubleName])).length / rows.length : null, disagreements: rows.filter(r => !same(r.policy.star, r.policy.doubles[doubleName])).map(r => ({ id: r.id, case: r.policy.case ?? null, star: r.policy.star.action, double: r.policy.doubles[doubleName].action })) };
}
