import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateResponse, validateRequest } from '../src/contract.mjs';

test('rounded probabilities over many options still validate, but a real gap does not', () => {
  const criteria = Object.fromEntries(Array.from({ length: 77 }, (_, i) => [`intent_${i}`, null]));
  const questions = { intent: { type: 'choice', instructions: 'Which?', criteria } };
  // Kev rounds to two decimals: 77 options at 0.01 each sums to 0.77, plus a 0.23 top choice = 1.00, then rounding drift.
  const probabilities = Object.fromEntries(Object.keys(criteria).map((k, i) => [k, i === 0 ? 0.4 : 0.01]));
  // sum = 0.4 + 0.76 = 1.16, drift 0.16 < 0.01 + 0.005 * 77 = 0.395
  assert.doesNotThrow(() => validateResponse({ answers: { intent: { type: 'choice', choice: 'intent_0', probabilities, confidence: 0.1 } } }, questions));
  const gap = { ...probabilities, intent_0: 0.9 }; // sum 1.66, drift 0.66
  assert.throws(() => validateResponse({ answers: { intent: { type: 'choice', choice: 'intent_0', probabilities: gap, confidence: 0.1 } } }, questions), /sum to one/);
  const two = { q: { type: 'choice', instructions: 'x', criteria: { a: null, b: null } } };
  assert.throws(() => validateResponse({ answers: { q: { type: 'choice', choice: 'a', probabilities: { a: 0.6, b: 0.5 } } } }, two), /sum to one/, 'two options allow only 0.02 drift');
});

test('score mean tolerance grows with the level count, a real inconsistency still fails', () => {
  const ten = { s: { type: 'score', instructions: 'x', criteria: Array.from({ length: 10 }, (_, i) => `level ${i}`) } };
  // Two decimals per level: 0.1 each → mean 4.5; the backend reports a rounded 4.62 (drift 0.12 < 0.02 + 0.005 * 45 = 0.245)
  const p = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), 0.1]));
  assert.doesNotThrow(() => validateResponse({ answers: { s: { type: 'score', score: 4.62, probabilities: p, confidence: 0.1 } } }, ten));
  assert.throws(() => validateResponse({ answers: { s: { type: 'score', score: 5.0, probabilities: p, confidence: 0.1 } } }, ten), /score inconsistent/);
  const two = { s: { type: 'score', instructions: 'x', criteria: ['a', 'b'] } };
  assert.throws(() => validateResponse({ answers: { s: { type: 'score', score: 0.75, probabilities: { 0: 0.3, 1: 0.7 } } } }, two), /score inconsistent/, 'two levels allow only 0.025');
});

test('usage is optional, extra fields are ignored, and shape errors are named', () => {
  const questions = { ok: { type: 'noul', instructions: 'Fine?' }, level: { type: 'score', instructions: 'How?', criteria: ['low', 'high'] } };
  assert.doesNotThrow(() => validateResponse({ model: 'x', answers: { ok: { type: 'noul', noul: 0.2, action: { extra: true } }, level: { type: 'score', score: 0.7, probabilities: { 0: 0.3, 1: 0.7 }, legend: { 0: 'low', 1: 'high' } } }, latency_ms: 3 }, questions));
  assert.throws(() => validateResponse({ answers: { ok: { type: 'noul', noul: 1.2 }, level: { type: 'score', score: 0.7, probabilities: { 0: 0.3, 1: 0.7 } } } }, questions), /ok: noul outside/);
  assert.throws(() => validateResponse({ answers: { ok: { type: 'noul', noul: 0.2 }, level: { type: 'score', score: 0.2, probabilities: { 0: 0.3, 1: 0.7 } } } }, questions), /score inconsistent/);
  assert.throws(() => validateResponse({ answers: { ok: { type: 'noul', noul: 0.2 } } }, questions), /answer IDs must match/);
  assert.throws(() => validateRequest({ state: 's', questions: { q: { type: 'choice', criteria: { a: null } } } }), /at least 2 criteria/);
});
