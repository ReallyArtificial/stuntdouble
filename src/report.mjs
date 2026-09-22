import { pairs, agreement, agreementWithLabel, gatedAgreement, scoreTolerance, brier, ece, coverageAtError, latency, availability, cost, policyAgreement } from './compare.mjs';
import { swapVerdict, savings } from './verdict.mjs';

export function buildReport(records, { config = null, maxDisagreement = 0.02, minRows = 20, noulThreshold = 0.5, scoreToleranceLevels = 0.5, budget = 0.05 } = {}) {
  const starName = records.find(r => r.star?.name)?.star.name ?? config?.star?.name ?? 'star';
  const doubleNames = [...new Set(records.flatMap(r => Object.keys(r.doubles ?? {})))];
  const starSpec = config?.star ?? {};
  const starCost = cost(records, starName, starSpec);
  const labeled = records.filter(r => r.label).length;
  const dates = records.map(r => r.ts).filter(Boolean).sort();
  const report = {
    generatedAt: new Date().toISOString(), records: records.length, labeled, replays: records.filter(r => r.replay).length,
    firstRecord: dates[0] ?? null, lastRecord: dates.at(-1) ?? null,
    settings: { maxDisagreement, minRows, noulThreshold, scoreToleranceLevels, budget },
    star: { name: starName, models: [...new Set(records.map(r => r.star?.model).filter(Boolean))], latency: latency(records, starName), cost: starCost, errors: records.filter(r => r.star?.error).length,
      accuracy: null, brier: null, ece: null, coverageAtError: null },
    doubles: {},
  };
  const allRows = doubleNames.length ? pairs(records, doubleNames[0], { noulThreshold }) : [];
  if (allRows.some(r => r.labelSelected !== null)) {
    report.star.accuracy = agreementWithLabel(allRows, 'star');
    report.star.brier = brier(allRows, 'star');
    report.star.ece = ece(allRows, 'star');
    report.star.coverageAtError = coverageAtError(allRows, 'star', budget);
  }
  for (const name of doubleNames) {
    const rows = pairs(records, name, { noulThreshold });
    const spec = config?.doubles?.find(d => d.name === name) ?? {};
    const gated = gatedAgreement(rows);
    const verdict = swapVerdict(gated, { maxDisagreement, minRows });
    const doubleCost = cost(records, name, spec);
    const byType = {};
    for (const type of ['noul', 'choice', 'score']) { const sub = rows.filter(r => r.type === type); if (sub.length) byType[type] = agreement(sub); }
    report.doubles[name] = {
      models: [...new Set(records.map(r => r.doubles?.[name]?.model).filter(Boolean))],
      availability: availability(records, name), latency: latency(records, name), cost: doubleCost,
      agreement: agreement(rows), agreementByType: byType, score: scoreTolerance(rows, scoreToleranceLevels), gated,
      accuracy: agreementWithLabel(rows, 'double'), brier: brier(rows, 'double'), ece: ece(rows, 'double'), coverageAtError: coverageAtError(rows, 'double', budget),
      policy: policyAgreement(records, name),
      verdict: { ...verdict, savingsUsdPer1000: savings(verdict, starCost, doubleCost) },
      disagreements: rows.filter(r => !r.error && r.doubleSelected !== null && r.doubleSelected !== r.starSelected).slice(0, 50).map(r => ({ id: r.id, qid: r.qid, type: r.type, star: r.starSelected, double: r.doubleSelected, doubleConfidence: r.doubleConfidence, label: r.labelSelected })),
    };
  }
  return report;
}

const pct = (x, d = 1) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(d)}%`);
const num = (x, d = 3) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(d));
const ms = (x) => (x === null || x === undefined ? 'n/a' : `${Math.round(x)} ms`);
const usd = (x) => (x === null || x === undefined ? 'n/a' : `$${x.toFixed(4)}`);

export function renderMarkdown(report) {
  const L = [];
  L.push(`# stuntdouble report`, '', `Generated ${report.generatedAt}. ${report.records} records${report.labeled ? `, ${report.labeled} labeled` : ''}${report.replays ? `, ${report.replays} replayed` : ''}, from ${report.firstRecord ?? 'n/a'} to ${report.lastRecord ?? 'n/a'}.`, '');
  L.push(`Agreement figures compare each double with the star (**${report.star.name}**, models: ${report.star.models.join(', ') || 'n/a'}). They measure whether the double would have produced the same decision, not whether either was right. Accuracy, Brier, ECE and coverage use labels and appear only where labels exist.`, '');
  L.push(`## Star: ${report.star.name}`, '', `| Metric | Value |`, `| --- | --- |`, `| Latency p50 / p95 | ${ms(report.star.latency.p50)} / ${ms(report.star.latency.p95)} |`, `| Cost per 1,000 decisions | ${usd(report.star.cost.usdPer1000)} (${report.star.cost.priced} priced) |`, `| Errors | ${report.star.errors} |`);
  if (report.star.accuracy) L.push(`| Accuracy vs label | ${pct(report.star.accuracy.accuracy)} (n=${report.star.accuracy.n}) |`, `| Brier | ${num(report.star.brier.brier)} |`, `| ECE | ${num(report.star.ece.ece)} |`, `| Coverage at ≤${pct(report.settings.budget, 0)} error | ${pct(report.star.coverageAtError.coverage)} |`);
  L.push('');
  for (const [name, d] of Object.entries(report.doubles)) {
    L.push(`## Double: ${name}`, '', `Models: ${d.models.join(', ') || 'n/a'}. Available ${pct(d.availability.available)} of ${d.availability.n} calls.`, '');
    L.push(`| Metric | Value |`, `| --- | --- |`);
    L.push(`| Label agreement with star | ${pct(d.agreement.agreement)} (n=${d.agreement.n}) |`);
    for (const [type, a] of Object.entries(d.agreementByType)) L.push(`| Agreement, ${type} questions | ${pct(a.agreement)} (n=${a.n}) |`);
    if (d.score.n) L.push(`| Score within ±${report.settings.scoreToleranceLevels} level | ${pct(d.score.withinTolerance)} (mean abs diff ${num(d.score.meanAbsoluteDifference, 2)}) |`);
    if (d.policy.n) L.push(`| **Policy agreement** (application decision unchanged) | ${pct(d.policy.agreement)} (n=${d.policy.n}) |`);
    L.push(`| Latency p50 / p95 | ${ms(d.latency.p50)} / ${ms(d.latency.p95)} |`, `| Cost per 1,000 decisions | ${usd(d.cost.usdPer1000)} |`);
    if (d.accuracy.n) L.push(`| Accuracy vs label | ${pct(d.accuracy.accuracy)} (n=${d.accuracy.n}) |`, `| Brier | ${num(d.brier.brier)} |`, `| ECE | ${num(d.ece.ece)} |`, `| Coverage at ≤${pct(report.settings.budget, 0)} error | ${pct(d.coverageAtError.coverage)} |`);
    L.push('', `### Confidence-gated agreement`, '', `| Double confidence ≥ | Share of traffic | Agreement with star | n |`, `| --- | --- | --- | --- |`);
    for (const g of d.gated) L.push(`| ${g.threshold} | ${pct(g.coverage)} | ${pct(g.agreement)} | ${g.n} |`);
    L.push('', `### Swap verdict`, '');
    const v = d.verdict;
    if (v.qualifies) L.push(`Route to **${name}** when its confidence is ≥ **${v.threshold}**: covers **${pct(v.coverage)}** of traffic at **${pct(v.disagreement)}** disagreement with ${report.star.name} (budget ${pct(v.maxDisagreement)}, n=${v.n}).${v.savingsUsdPer1000 !== null ? ` Estimated saving ${usd(v.savingsUsdPer1000)} per 1,000 decisions.` : ''} Latency p50 ${ms(d.latency.p50)} vs ${ms(report.star.latency.p50)}.`);
    else L.push(`No confidence threshold keeps disagreement with ${report.star.name} within ${pct(v.maxDisagreement)} on at least ${v.minRows} rows. Do not route to **${name}** on this traffic without changing the budget or collecting more records.`);
    if (d.policy.disagreements.length) { L.push('', `### Policy disagreements`, '', `| Case | ${report.star.name} | ${name} |`, `| --- | --- | --- |`); for (const p of d.policy.disagreements) L.push(`| ${p.case ?? p.id} | ${p.star} | ${p.double} |`); }
    if (d.disagreements.length) { L.push('', `### Sample disagreements (first ${d.disagreements.length})`, '', `| Record | Question | ${report.star.name} | ${name} | Double conf. | Label |`, `| --- | --- | --- | --- | --- | --- |`); for (const x of d.disagreements) L.push(`| ${x.id.slice(0, 8)} | ${x.qid} | ${x.star} | ${x.double} | ${num(x.doubleConfidence, 2)} | ${x.label ?? ''} |`); }
    L.push('');
  }
  L.push(`---`, `Latency is measured by the proxy from request send to last byte, on this machine, and includes network time for hosted backends. Cost counts only responses whose returned model matches the priced one. Confidence for Noul is max(p, 1−p); for Choice and Score it is the backend's reported confidence, or the top probability when absent.`);
  return L.join('\n') + '\n';
}
