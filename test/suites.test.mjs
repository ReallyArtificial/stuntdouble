import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importKev, importJevbench, importSemif, importJbe, sample } from '../src/suites.mjs';

const dir = mkdtempSync(join(tmpdir(), 'stuntdouble-suites-'));
const file = (name, lines) => { const p = join(dir, name); writeFileSync(p, lines.map(l => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n'); return p; };

test('kev rows keep the request shape and lift per-question labels out', async () => {
  const p = file('kev.jsonl', [
    { state: 'Why has my $1 reversal not arrived?', questions: { intent: { type: 'choice', instructions: 'Which intent?', criteria: { refund: null, card: null }, label: 'refund', src: 'banking77' } }, _meta: { id: 'banking77/test/196', source: 'banking77', group_id: 'g1' } },
    { state: 'Is the sky blue?', questions: { q: { type: 'noul', instructions: 'Yes?', label: 'yes' } }, _meta: { id: 'boolq/1', source: 'boolq' } },
  ]);
  const items = await importKev(p);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'banking77/test/196');
  assert.deepEqual(Object.keys(items[0].request.questions.intent), ['type', 'instructions', 'criteria'], 'label and src stripped from the request');
  assert.deepEqual(items[0].label, { intent: 'refund' });
  assert.equal(items[1].label.q, true, 'noul labels become booleans');
  assert.equal(items[0].meta.src, 'banking77');
});

test('jevbench items become one-question requests with the expected answer as label', async () => {
  const p = file('hard.jsonl', [{ id: 'hard-1', expected: 'pay_15000', family: 'long_policy', group: 'g', labels: ['deny', 'pay_15000'], question: { type: 'choice', instructions: 'Decide.', criteria: { deny: 'no', pay_15000: 'yes' } }, state: 'POLICY…' }]);
  const items = await importJevbench(p);
  assert.equal(items[0].request.questions.answer.criteria.pay_15000, 'yes');
  assert.deepEqual(items[0].label, { answer: 'pay_15000' });
  assert.equal(items[0].meta.family, 'long_policy');
});

test('semif rows map options to choice criteria and carry no label', async () => {
  const p = file('semif.jsonl', [{ id: 'route-1', state: 'Reset email never arrived.', question: 'Which queue?', options: [{ id: 'account_access', description: 'Auth' }, { id: 'billing', description: 'Money' }] }]);
  const items = await importSemif(p);
  const q = items[0].request.questions.answer;
  assert.equal(q.type, 'choice');
  assert.deepEqual(q.criteria, { account_access: 'Auth', billing: 'Money' });
  assert.equal(items[0].label, null);
});

test('jbe import skips preflight-settled cases and wires decide for policy agreement', async () => {
  const root = join(dir, 'jbe'); mkdirSync(join(root, 'examples', '01-demo'), { recursive: true });
  writeFileSync(join(root, 'examples', '01-demo', 'example.mjs'), `
    export default {
      id: '01-demo',
      preflight: (s) => s.blocked ? { action: 'stop', reason: 'rule' } : undefined,
      questions: (s) => ({ ok: { type: 'noul', instructions: 'Is it fine?' } }),
      decide: (s, a) => ({ action: a.ok.noul >= 0.9 ? 'go' : 'hold', reason: 'threshold', threshold: 0.9 }),
      baseline: () => ({ action: 'go', reason: 'always' }),
      cases: [
        { id: 'clear', state: { text: 'x' }, fixture: { ok: 0.95 }, expected: 'go' },
        { id: 'blocked', state: { blocked: true }, fixture: { ok: 0.95 }, expected: 'stop' },
      ],
    };`);
  const items = await importJbe(root);
  assert.equal(items.length, 1, 'the preflight case makes no model call and is skipped');
  assert.equal(items[0].id, '01-demo/clear');
  assert.equal(items[0].request.questions.ok.type, 'noul');
  assert.equal(items[0].policy.decide({ ok: { type: 'noul', noul: 0.95 } }).action, 'go');
  assert.equal(items[0].policy.decide({ ok: { type: 'noul', noul: 0.85 } }).action, 'hold', 'a flipped answer flips the policy');
  assert.deepEqual(items[0].policy.expected, { action: 'go' });
});

test('sample is deterministic and returns the requested count', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
  const a = sample(items, 10).map(x => x.id), b = sample(items, 10).map(x => x.id);
  assert.equal(a.length, 10);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, items.slice(0, 10).map(x => x.id), 'not just the head of the list');
  assert.equal(sample(items, 500).length, 50);
});
