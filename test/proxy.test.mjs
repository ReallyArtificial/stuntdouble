import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { createProxy } from '../src/proxy.mjs';
import { normalizeConfig } from '../src/backends.mjs';

const questions = { escalate: { type: 'noul', instructions: 'Urgent?' }, dept: { type: 'choice', instructions: 'Which?', criteria: { a: null, b: null } } };
const request = { model: 'jev-1.13.0', state: 'Two charges on my card.', questions };
const starBody = JSON.stringify({ model: 'jev-1.13.0', answers: { escalate: { type: 'noul', noul: 0.93 }, dept: { type: 'choice', choice: 'b', probabilities: { a: 0.2, b: 0.8 }, confidence: 0.7 } }, usage: { input_tokens: 12, output_tokens: 0 }, latency_ms: 42, extra: { keep: 'me' } });

function fakeServer(handler) {
  return new Promise(resolve => { const s = createServer(handler); s.listen(0, '127.0.0.1', () => resolve({ server: s, url: `http://127.0.0.1:${s.address().port}` })); });
}
const listen = (server) => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const readJson = (req) => new Promise(resolve => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => resolve(JSON.parse(Buffer.concat(c).toString()))); });

test('star reply passes through byte-for-byte, including unknown fields, and headers', async () => {
  const seen = { auth: null, model: null };
  const star = await fakeServer(async (req, res) => { seen.auth = req.headers.authorization; seen.model = (await readJson(req)).model; res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': 'abc' }); res.end(starBody); });
  const double = await fakeServer(async (req, res) => { const body = await readJson(req); assert.equal(body.model, 'kev-latest', 'double gets its own model name'); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ model: 'kev', answers: { escalate: { type: 'noul', noul: 0.4 }, dept: { type: 'choice', choice: 'b', probabilities: { a: 0.3, b: 0.7 }, confidence: 0.5 } } })); });
  const records = [];
  const proxy = createProxy(normalizeConfig({ star: { name: 'jev', url: star.url }, doubles: [{ name: 'kev', url: double.url, model: 'kev-latest' }] }), { onRecord: r => records.push(r) });
  const url = await listen(proxy);
  const res = await fetch(`${url}/v1/systemone`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer secret' }, body: JSON.stringify(request) });
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.equal(text, starBody, 'exact bytes');
  assert.equal(res.headers.get('x-request-id'), 'abc');
  assert.equal(res.headers.get('x-stuntdouble-doubles'), 'kev');
  assert.ok(res.headers.get('x-stuntdouble-id'));
  assert.equal(seen.auth, 'Bearer secret', 'auth forwarded to the star only');
  assert.equal(seen.model, 'jev-1.13.0', 'star request not rewritten');
  await proxy.drain();
  assert.equal(records.length, 1);
  assert.equal(records[0].star.model, 'jev-1.13.0');
  assert.equal(records[0].doubles.kev.answers.escalate.noul, 0.4);
  assert.equal(records[0].doubles.kev.error, null);
  proxy.close(); star.server.close(); double.server.close();
});

test('a slow or failing double never delays or changes the reply', async () => {
  const star = await fakeServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(starBody); });
  const slow = await fakeServer(async (req, res) => { await sleep(400); res.writeHead(200, { 'content-type': 'application/json' }); res.end(starBody); });
  const broken = await fakeServer((req, res) => { res.writeHead(500); res.end('boom'); });
  const records = [];
  const proxy = createProxy(normalizeConfig({ star: { name: 'jev', url: star.url }, doubles: [{ name: 'slow', url: slow.url, timeoutMs: 100 }, { name: 'broken', url: broken.url }] }), { onRecord: r => records.push(r) });
  const url = await listen(proxy);
  const t = performance.now();
  const res = await fetch(`${url}/v1/systemone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  const elapsed = performance.now() - t;
  assert.equal(await res.text(), starBody);
  assert.ok(elapsed < 300, `reply took ${elapsed}ms; must not wait for the slow double`);
  await proxy.drain();
  assert.equal(records[0].doubles.slow.error, 'timeout');
  assert.equal(records[0].doubles.slow.answers, null);
  assert.equal(records[0].doubles.broken.error, 'http 500');
  proxy.close(); star.server.close(); slow.server.close(); broken.server.close();
});

test('star 429 passes through and the record keeps no star answers', async () => {
  const star = await fakeServer((req, res) => { res.writeHead(429, { 'retry-after': '3', 'content-type': 'application/json' }); res.end('{"error":"rate"}'); });
  const records = [];
  const proxy = createProxy(normalizeConfig({ star: { name: 'jev', url: star.url }, doubles: [] }), { onRecord: r => records.push(r) });
  const url = await listen(proxy);
  const res = await fetch(`${url}/v1/systemone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '3');
  assert.equal(await res.text(), '{"error":"rate"}');
  await proxy.drain();
  assert.equal(records[0].star.error, 'http 429');
  assert.equal(records[0].star.answers, null);
  proxy.close(); star.server.close();
});

test('label header is parsed, stripped from the forwarded request, and state can be redacted', async () => {
  let forwarded = null;
  const star = await fakeServer((req, res) => { forwarded = req.headers; res.writeHead(200, { 'content-type': 'application/json' }); res.end(starBody); });
  const records = [];
  const proxy = createProxy(normalizeConfig({ star: { name: 'jev', url: star.url }, doubles: [], redactState: true }), { onRecord: r => records.push(r) });
  const url = await listen(proxy);
  await fetch(`${url}/v1/systemone`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-stuntdouble-label': JSON.stringify({ escalate: true, dept: 'b' }) }, body: JSON.stringify(request) });
  await proxy.drain();
  assert.equal(forwarded['x-stuntdouble-label'], undefined);
  assert.deepEqual(records[0].label, { escalate: true, dept: 'b' });
  assert.equal(records[0].request.state, null);
  assert.equal(records[0].requestSha256.length, 64);
  proxy.close(); star.server.close();
});

test('sampleRate 0 still calls the star and records no doubles', async () => {
  let doubleCalls = 0;
  const star = await fakeServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(starBody); });
  const double = await fakeServer((req, res) => { doubleCalls++; res.writeHead(200, { 'content-type': 'application/json' }); res.end(starBody); });
  const records = [];
  const proxy = createProxy(normalizeConfig({ star: { name: 'jev', url: star.url }, doubles: [{ name: 'd', url: double.url }], sampleRate: 0 }), { onRecord: r => records.push(r) });
  const url = await listen(proxy);
  const res = await fetch(`${url}/v1/systemone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  assert.equal(res.status, 200);
  await proxy.drain();
  assert.equal(doubleCalls, 0);
  assert.deepEqual(records[0].doubles, {});
  proxy.close(); star.server.close(); double.server.close();
});
