import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'stuntdouble-cli-'));

const questions = { escalate: { type: 'noul', instructions: 'Urgent?' } };
const rec = (id, star, dbl, label) => ({ id, ts: '2026-09-22T12:00:00.000Z', request: { model: 'jev-1.13.0', state: 's', questions }, requestSha256: 'x', label,
  star: { name: 'jev', status: 200, model: 'jev-1.13.0', answers: { escalate: { type: 'noul', noul: star } }, usage: { input_tokens: 100, output_tokens: 0 }, elapsedMs: 200, error: null },
  doubles: { kev: { name: 'kev', status: 200, model: 'kev-latest', answers: { escalate: { type: 'noul', noul: dbl } }, usage: null, elapsedMs: 20, error: null } } });
const records = [rec('1', 0.9, 0.95, { escalate: true }), rec('2', 0.1, 0.05, { escalate: false }), rec('3', 0.8, 0.3, { escalate: true }), rec('4', 0.95, 0.99, null)];
const recordsPath = join(dir, 'r.jsonl');
writeFileSync(recordsPath, records.map(r => JSON.stringify(r)).join('\n') + '\n');

test('help prints usage and exits 0', async () => {
  const { stdout } = await run('node', [cli, '--help']);
  assert.match(stdout, /stuntdouble serve/);
});

test('report renders markdown with the verdict and writes json', async () => {
  const json = join(dir, 'report.json');
  const { stdout } = await run('node', [cli, 'report', recordsPath, '--json', json, '--max-disagreement', '0.5', '--min-rows', '1']);
  assert.match(stdout, /## Double: kev/);
  assert.match(stdout, /Label agreement with star \| 75\.0% \(n=4\)/);
  assert.match(stdout, /Accuracy vs label \| 66\.7% \(n=3\)/, 'double is wrong on the labeled flip');
  assert.match(stdout, /Route to \*\*kev\*\*/);
  const parsed = JSON.parse(readFileSync(json, 'utf8'));
  assert.equal(parsed.doubles.kev.agreement.agreement, 0.75);
  assert.equal(parsed.star.accuracy.accuracy, 1);
});

test('report refuses to overwrite an existing output file', async () => {
  const out = join(dir, 'exists.md'); writeFileSync(out, 'x');
  await assert.rejects(run('node', [cli, 'report', recordsPath, '--out', out]), /exists/);
});

test('replay re-runs recorded requests against a new double and keeps the star', async () => {
  let calls = 0;
  const server = createServer((req, res) => { calls++; res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ model: 'laya', answers: { escalate: { type: 'noul', noul: 0.5 } } })); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const out = join(dir, 'replay.jsonl');
  await run('node', [cli, 'replay', recordsPath, '--double', `laya=http://127.0.0.1:${server.address().port}`, '--out', out]);
  server.close();
  assert.equal(calls, 4);
  const lines = readFileSync(out, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines[0].replay, true);
  assert.equal(lines[0].star.answers.escalate.noul, 0.9, 'star answer is the recorded one');
  assert.equal(lines[0].doubles.laya.answers.escalate.noul, 0.5);
  assert.equal(lines[0].doubles.kev.answers.escalate.noul, 0.95, 'earlier doubles are kept');
});

test('suite run calls star and double per item, records labels, and computes policy for jbe', async () => {
  const star = createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ model: 'jev-1.13.0', answers: { ok: { type: 'noul', noul: 0.95 } }, usage: { input_tokens: 10, output_tokens: 0 } })); });
  const dbl = createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ model: 'kev', answers: { ok: { type: 'noul', noul: 0.6 } } })); });
  await Promise.all([new Promise(r => star.listen(0, '127.0.0.1', r)), new Promise(r => dbl.listen(0, '127.0.0.1', r))]);
  const root = join(dir, 'jbe'); const { mkdirSync } = await import('node:fs'); mkdirSync(join(root, 'examples', '01-demo'), { recursive: true });
  writeFileSync(join(root, 'examples', '01-demo', 'example.mjs'), `export default { id: '01-demo', questions: () => ({ ok: { type: 'noul', instructions: 'Fine?' } }), decide: (s, a) => ({ action: a.ok.noul >= 0.9 ? 'go' : 'hold', reason: 'r' }), baseline: () => ({ action: 'go', reason: 'b' }), cases: [{ id: 'c1', state: { t: 1 }, fixture: { ok: 0.95 }, expected: 'go' }] };`);
  const out = join(dir, 'suite.jsonl');
  await run('node', [cli, 'suite', 'run', `jbe:${root}`, '--star', `jev=http://127.0.0.1:${star.address().port},jev-1.13.0`, '--double', `kev=http://127.0.0.1:${dbl.address().port},kev-latest`, '--out', out]);
  star.close(); dbl.close();
  const line = JSON.parse(readFileSync(out, 'utf8').trim());
  assert.equal(line.suite.id, '01-demo/c1');
  assert.equal(line.policy.star.action, 'go');
  assert.equal(line.policy.doubles.kev.action, 'hold', 'the double flips the application decision');
  const { stdout } = await run('node', [cli, 'report', out]);
  assert.match(stdout, /Policy agreement.*0\.0% \(n=1\)/);
  assert.match(stdout, /\| 01-demo\/c1 \| go \| hold \|/);
});

test('suite import kev writes a normalized suite', async () => {
  const src = join(dir, 'kev.jsonl');
  writeFileSync(src, JSON.stringify({ state: 's', questions: { q: { type: 'noul', instructions: 'i', label: 'yes' } }, _meta: { id: 'k/1', source: 'boolq' } }) + '\n');
  const out = join(dir, 'suites', 'kev.jsonl');
  await run('node', [cli, 'suite', 'import', 'kev', src, '--out', out]);
  assert.ok(existsSync(out));
  const item = JSON.parse(readFileSync(out, 'utf8').trim());
  assert.deepEqual(item.label, { q: true });
});
