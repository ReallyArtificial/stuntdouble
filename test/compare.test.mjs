import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairs, agreement, agreementWithLabel, gatedAgreement, brier, ece, coverageAtError, latency, cost, policyAgreement, selected, confidence } from '../src/compare.mjs';

const questions = {
  department: { type: 'choice', instructions: 'Which team?', criteria: { returns: 'a', shipping: 'b', billing: 'c' } },
  escalate: { type: 'noul', instructions: 'Urgent?' },
  frustration: { type: 'score', instructions: 'How frustrated?', criteria: ['Calm', 'Frustrated', 'Very angry'] },
};
const choice = (p, confidence) => ({ type: 'choice', choice: Object.entries(p).sort((a, b) => b[1] - a[1])[0][0], probabilities: p, confidence });
const score = (p, confidence) => ({ type: 'score', score: Object.entries(p).reduce((s, [k, v]) => s + Number(k) * v, 0), probabilities: p, confidence, legend: { 0: 'Calm', 1: 'Frustrated', 2: 'Very angry' } });
const noul = (v) => ({ type: 'noul', noul: v });

const record = (id, starAnswers, doubleAnswers, extra = {}) => ({
  id, ts: '2026-09-22T12:00:00.000Z', request: { model: 'jev-1.13.0', state: 'x', questions },
  star: { name: 'jev', status: 200, model: 'jev-1.13.0', answers: starAnswers, usage: { input_tokens: 400, output_tokens: 0 }, elapsedMs: 240, error: null },
  doubles: { kev: { name: 'kev', status: 200, model: 'kev-latest', answers: doubleAnswers, usage: { input_tokens: 410, output_tokens: 0 }, elapsedMs: 500, error: null } },
  ...extra,
});

const agreeing = record('a',
  { department: choice({ returns: 0.7, shipping: 0.2, billing: 0.1 }, 0.9), escalate: noul(0.93), frustration: score({ 0: 0.0, 1: 0.56, 2: 0.44 }, 0.7) },
  { department: choice({ returns: 0.6, shipping: 0.3, billing: 0.1 }, 0.93), escalate: noul(0.88), frustration: score({ 0: 0.1, 1: 0.6, 2: 0.3 }, 0.8) });
const flipped = record('b',
  { department: choice({ returns: 0.7, shipping: 0.2, billing: 0.1 }, 0.9), escalate: noul(0.93), frustration: score({ 0: 0.0, 1: 0.56, 2: 0.44 }, 0.7) },
  { department: choice({ returns: 0.3, shipping: 0.1, billing: 0.6 }, 0.61), escalate: noul(0.2), frustration: score({ 0: 0.0, 1: 0.1, 2: 0.9 }, 0.95) },
  { label: { department: 'returns', escalate: true, frustration: 1 } });

test('selected and confidence per primitive', () => {
  assert.equal(selected(noul(0.49), questions.escalate), 'no');
  assert.equal(selected(noul(0.5), questions.escalate), 'yes');
  assert.equal(confidence(noul(0.2), questions.escalate), 0.8);
  assert.equal(selected(score({ 0: 0.0, 1: 0.56, 2: 0.44 }), questions.frustration), '1');
  assert.equal(selected(score({ 0: 0.0, 1: 0.4, 2: 0.6 }), questions.frustration), '2');
  assert.equal(confidence(choice({ returns: 0.7, shipping: 0.3, billing: 0 }), questions.department), 0.7, 'falls back to top probability');
});

test('agreement counts every question, not every record', () => {
  const rows = pairs([agreeing, flipped], 'kev');
  assert.equal(rows.length, 6);
  const a = agreement(rows);
  assert.equal(a.n, 6);
  assert.equal(a.agreement, 3 / 6);
});

test('gated agreement rises with threshold and coverage falls', () => {
  const rows = pairs([agreeing, flipped], 'kev');
  const g = Object.fromEntries(gatedAgreement(rows, [0.6, 0.9]).map(x => [x.threshold, x]));
  // Double confidences: agreeing = 0.93, 0.88, 0.8; flipped = 0.61, 0.8 (noul 0.2 → 0.8), 0.95
  assert.equal(g[0.6].n, 6);
  assert.equal(g[0.6].agreement, 0.5);
  assert.equal(g[0.9].n, 2);
  assert.equal(g[0.9].agreement, 0.5, 'the 0.95-confidence score flip counts against it');
  assert.equal(g[0.9].coverage, 2 / 6);
});

test('label metrics use only labeled records and see the double being wrong', () => {
  const rows = pairs([agreeing, flipped], 'kev');
  assert.equal(agreementWithLabel(rows, 'double').n, 3);
  assert.equal(agreementWithLabel(rows, 'double').accuracy, 0);
  assert.equal(agreementWithLabel(rows, 'star').accuracy, 1);
  const b = brier(rows, 'star');
  assert.equal(b.n, 3);
  // star department: (0.3)^2 + 0.2^2 + 0.1^2 = 0.14; escalate [0.93,0.07] vs [1,0] = 0.0098; frustration [0,0.56,0.44] vs [0,1,0] = 0.3872
  assert.ok(Math.abs(b.brier - (0.14 + 0.0098 + 0.3872) / 3) < 1e-9);
  assert.ok(brier(rows, 'double').brier > b.brier, 'wrong double has worse Brier');
});

test('brier of a perfect one-hot is 0 and of uniform-over-4 is 0.75', () => {
  const q = { q: { type: 'choice', instructions: 'x', criteria: { a: null, b: null, c: null, d: null } } };
  const mk = (p) => ({ id: 'r', ts: 't', request: { questions: q }, label: { q: 'a' }, star: { name: 's', answers: { q: choice(p, 1) } }, doubles: { d: { name: 'd', answers: { q: choice(p, 1) }, error: null } } });
  assert.equal(brier(pairs([mk({ a: 1, b: 0, c: 0, d: 0 })], 'd'), 'double').brier, 0);
  assert.ok(Math.abs(brier(pairs([mk({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 })], 'd'), 'double').brier - 0.75) < 1e-9);
});

test('ece is zero when confidence equals accuracy in every bin', () => {
  const q = { q: { type: 'noul', instructions: 'x' } };
  const mk = (id, p, label) => ({ id, ts: 't', request: { questions: q }, label: { q: label }, star: { name: 's', answers: { q: noul(p) } }, doubles: { d: { name: 'd', answers: { q: noul(p) }, error: null } } });
  // Four rows at confidence 0.75, three correct: |0.75 - 0.75| = 0
  const rows = pairs([mk('1', 0.75, true), mk('2', 0.75, true), mk('3', 0.75, true), mk('4', 0.75, false)], 'd');
  assert.ok(Math.abs(ece(rows, 'double').ece) < 1e-9);
  // Four rows at 0.75, one correct: ECE = |0.75 - 0.25| = 0.5
  const bad = pairs([mk('1', 0.75, true), mk('2', 0.75, false), mk('3', 0.75, false), mk('4', 0.75, false)], 'd');
  assert.ok(Math.abs(ece(bad, 'double').ece - 0.5) < 1e-9);
});

test('coverage at error admits tie groups whole and stops at the budget', () => {
  const q = { q: { type: 'noul', instructions: 'x' } };
  const mk = (id, p, label) => ({ id, ts: 't', request: { questions: q }, label: { q: label }, star: { name: 's', answers: { q: noul(p) } }, doubles: { d: { name: 'd', answers: { q: noul(p) }, error: null } } });
  const rows = pairs([mk('1', 0.99, true), mk('2', 0.98, true), mk('3', 0.9, false), mk('4', 0.9, true), mk('5', 0.6, true)], 'd');
  // accept 0.99, 0.98 → 2/5 with 0 errors; the 0.9 tie group adds one error (1/4 = 25%) → stop
  assert.equal(coverageAtError(rows, 'double', 0.05).coverage, 2 / 5);
  assert.equal(coverageAtError(rows, 'double', 0.3).coverage, 1, 'a loose budget admits everything');
});

test('latency percentiles and cost per 1,000 decisions', () => {
  const recs = [agreeing, flipped, record('c', agreeing.star.answers, agreeing.doubles.kev.answers)];
  recs[2].star.elapsedMs = 900;
  assert.deepEqual(latency(recs, 'jev').p50, 240);
  assert.equal(latency(recs, 'jev').p95, 900);
  const c = cost(recs, 'jev', { pricePerMillionInput: 0.042, model: 'jev-1.13.0' });
  assert.equal(c.priced, 3);
  assert.ok(Math.abs(c.usdPer1000 - 400 * 0.042 / 1e6 * 1000) < 1e-12);
  assert.equal(cost(recs, 'jev', { pricePerMillionInput: 0.042, model: 'jev-9.9.9' }).priced, 0, 'only the priced model counts');
});

test('policy agreement compares the application decision, including details', () => {
  const recs = [
    { ...agreeing, policy: { case: '02/a', star: { action: 'keep-scoped', details: null }, doubles: { kev: { action: 'keep-scoped', details: null } } } },
    { ...flipped, policy: { case: '07/b', star: { action: 'pack', details: { selected: ['a', 'b'] } }, doubles: { kev: { action: 'pack', details: { selected: ['a'] } } } } },
  ];
  const p = policyAgreement(recs, 'kev');
  assert.equal(p.n, 2);
  assert.equal(p.agreement, 0.5, 'same action with different details is a disagreement');
  assert.equal(p.disagreements[0].case, '07/b');
});

test('double errors are excluded from agreement, never counted as disagreement', () => {
  const broken = record('d', agreeing.star.answers, null);
  broken.doubles.kev.error = 'timeout';
  broken.doubles.kev.answers = null;
  const rows = pairs([agreeing, broken], 'kev');
  assert.equal(rows.filter(r => r.error).length, 3);
  assert.equal(agreement(rows).n, 3);
  assert.equal(agreement(rows).agreement, 1);
});
