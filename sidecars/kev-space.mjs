#!/usr/bin/env node
// Expose the Kev Hugging Face Space (Kev-4B / Kev-0.8B on ZeroGPU) on POST /v1/systemone.
//
//   node sidecars/kev-space.mjs --port 8012 [--model Kev-4B|Kev-0.8B] [--calibrated true]
//
// The Space's Gradio API returns the same /v1/systemone response kev.serve would produce (fp32, GPU).
// A Hugging Face token (HF_TOKEN, or ~/.cache/huggingface/token) gives queue priority on ZeroGPU;
// anonymous calls often time out in the queue. Standard library only.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i === -1 ? fallback : args[i + 1]; };
const PORT = Number(flag('port', 8012));
const MODEL = flag('model', 'Kev-4B');
const CALIBRATED = flag('calibrated', 'true') !== 'false';
const SPACE = flag('space', 'https://jaredpalmer-kev.hf.space');
let token = process.env.HF_TOKEN ?? '';
if (!token) { try { token = readFileSync(join(homedir(), '.cache', 'huggingface', 'token'), 'utf8').trim(); } catch { /* anonymous */ } }
const auth = token ? { authorization: `Bearer ${token}` } : {};

async function decide(state, questions) {
  const stateText = typeof state === 'string' ? state : JSON.stringify(state, null, 2);
  const start = await fetch(`${SPACE}/gradio_api/call/decide`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ data: [stateText, JSON.stringify(questions), MODEL, CALIBRATED, false, false, 4] }), signal: AbortSignal.timeout(30_000) });
  if (!start.ok) throw new Error(`space call: http ${start.status}`);
  const { event_id } = await start.json();
  const stream = await fetch(`${SPACE}/gradio_api/call/decide/${event_id}`, { headers: auth, signal: AbortSignal.timeout(240_000) });
  const text = await stream.text();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'event: error') throw new Error(`space: ${lines[i + 1]?.slice(0, 200)}`);
    if (lines[i] === 'event: complete') return JSON.parse(lines[i + 1].slice(5))[1];
  }
  throw new Error('space: stream ended without a result');
}

const server = createServer(async (req, res) => {
  const send = (status, body) => { const data = Buffer.from(JSON.stringify(body)); res.writeHead(status, { 'content-type': 'application/json', 'content-length': data.length }); res.end(data); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, model: MODEL, space: SPACE, calibrated: CALIBRATED, token: Boolean(token) });
  if (req.method !== 'POST' || req.url !== '/v1/systemone') return send(404, { error: 'not found' });
  const chunks = []; for await (const c of req) chunks.push(c);
  let body; try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { return send(400, { error: 'invalid json' }); }
  const t = performance.now();
  try {
    const raw = await decide(body.state, body.questions);
    send(200, { ...raw, model: raw.model ?? `${MODEL.toLowerCase()}-space`, latency_ms: Math.round(performance.now() - t) });
  } catch (error) { send(502, { error: error.message }); }
});
server.listen(PORT, '127.0.0.1', () => console.error(`kev-space sidecar on http://127.0.0.1:${PORT}/v1/systemone (${MODEL}, calibrated=${CALIBRATED}, token=${Boolean(token)})`));
