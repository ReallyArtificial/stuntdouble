import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swapVerdict, savings } from '../src/verdict.mjs';

const gated = (rows) => rows.map(([threshold, n, agreement, coverage]) => ({ threshold, n, agreement, coverage }));

test('picks the lowest threshold whose disagreement is within budget', () => {
  const g = gated([[0.5, 100, 0.90, 1], [0.7, 80, 0.97, 0.8], [0.8, 60, 0.985, 0.6], [0.9, 30, 0.99, 0.3]]);
  const v = swapVerdict(g, { maxDisagreement: 0.02 });
  assert.equal(v.qualifies, true);
  assert.equal(v.threshold, 0.8, 'the 0.7 row is at 3% disagreement, over budget');
  assert.equal(v.coverage, 0.6);
  assert.ok(Math.abs(v.disagreement - 0.015) < 1e-9);
});

test('does not qualify when no threshold meets the budget on enough rows', () => {
  const g = gated([[0.5, 100, 0.90, 1], [0.9, 10, 1.0, 0.1]]);
  const v = swapVerdict(g, { maxDisagreement: 0.02, minRows: 20 });
  assert.equal(v.qualifies, false, 'the perfect row has too few samples');
  assert.equal(v.threshold, null);
  assert.equal(swapVerdict(g, { maxDisagreement: 0.02, minRows: 5 }).threshold, 0.9);
});

test('a zero budget rejects any disagreement at all', () => {
  const g = gated([[0.9, 50, 0.98, 0.5], [0.95, 40, 1.0, 0.4]]);
  assert.equal(swapVerdict(g, { maxDisagreement: 0 }).threshold, 0.95);
  assert.equal(swapVerdict(gated([[0.97, 40, 0.999, 0.4]]), { maxDisagreement: 0 }).qualifies, false);
});

test('savings scale with coverage and the price gap', () => {
  const v = { qualifies: true, coverage: 0.6 };
  assert.ok(Math.abs(savings(v, { usdPer1000: 0.04 }, { usdPer1000: 0 }) - 0.024) < 1e-12);
  assert.ok(Math.abs(savings(v, { usdPer1000: 0.04 }, { usdPer1000: 0.01 }) - 0.018) < 1e-12);
  assert.equal(savings({ qualifies: false }, { usdPer1000: 0.04 }, null), null);
  assert.equal(savings(v, { usdPer1000: null }, null), null, 'no star price, no claim');
});
