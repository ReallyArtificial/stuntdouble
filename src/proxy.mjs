import { createServer } from 'node:http';
import { createBackend, forwardHeaders } from './backends.mjs';
import { makeRecord } from './record.mjs';

const DROP_FROM_REPLY = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive']);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// The app talks to this server exactly as it would talk to the star. The star's reply is
// returned byte-for-byte. Doubles run alongside and never delay or alter the reply.
export function createProxy(config, { recorder, fetchImpl = globalThis.fetch, random = Math.random, onRecord = () => {}, log = () => {} } = {}) {
  const star = createBackend(config.star, { fetchImpl });
  const doubles = config.doubles.map(d => createBackend(d, { fetchImpl }));
  const pending = new Set();

  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, star: star.name, doubles: doubles.map(d => d.name) })); return; }
    if (req.method !== 'POST' || req.url !== '/v1/systemone') { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"stuntdouble only proxies POST /v1/systemone"}'); return; }

    const bytes = await readBody(req);
    let request = null;
    try { request = JSON.parse(bytes.toString('utf8')); } catch { /* still forward; the star will answer 4xx */ }
    let label = null;
    if (req.headers['x-stuntdouble-label']) { try { label = JSON.parse(req.headers['x-stuntdouble-label']); } catch { label = null; } }
    const headers = forwardHeaders(req.headers);
    delete headers['x-stuntdouble-label'];

    const sampled = random() < config.sampleRate;
    const starCall = star.call(request ?? {}, { headers, rewriteModel: false, timeoutMs: config.timeoutMs });
    // Fan out to doubles at the same time, only for well-formed requests.
    const doubleCalls = request && sampled ? doubles.map(d => d.call(request, { timeoutMs: d.spec.timeoutMs ?? 5000 })) : [];

    const starResult = await starCall;
    if (starResult.status === null) { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: `star ${starResult.error}` })); }
    else {
      const replyHeaders = {};
      for (const [k, v] of Object.entries(starResult.headers)) if (!DROP_FROM_REPLY.has(k)) replyHeaders[k] = v;
      replyHeaders['content-length'] = starResult.bytes.length;
      replyHeaders['x-stuntdouble-doubles'] = doubleCalls.length ? doubles.map(d => d.name).join(',') : '';
      const record = request ? makeRecord({ request, label, star: starResult, redactState: config.redactState }) : null;
      if (record) replyHeaders['x-stuntdouble-id'] = record.id;
      res.writeHead(starResult.status, replyHeaders);
      res.end(starResult.bytes);
      if (record) {
        const task = Promise.all(doubleCalls).then(results => {
          for (const r of results) record.doubles[r.name] = { name: r.name, status: r.status, model: r.model, answers: r.answers, usage: r.usage, elapsedMs: r.elapsedMs, error: r.error };
          recorder?.append(record);
          onRecord(record);
          log(`${record.id.slice(0, 8)} star=${starResult.status} ${starResult.elapsedMs}ms ` + results.map(r => `${r.name}=${r.error ?? r.status} ${r.elapsedMs}ms`).join(' '));
        }).catch(error => log(`record failed: ${error.message}`)).finally(() => pending.delete(task));
        pending.add(task);
        return;
      }
    }
    await Promise.allSettled(doubleCalls);
  });
  server.drain = () => Promise.allSettled([...pending]);
  return server;
}
