#!/usr/bin/env node
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { resolve, dirname } from 'node:path';
import { createProxy } from './proxy.mjs';
import { createBackend, normalizeConfig } from './backends.mjs';
import { createRecorder, readRecords, makeRecord } from './record.mjs';
import { buildReport, renderMarkdown } from './report.mjs';
import { IMPORTERS, loadSuite, sample } from './suites.mjs';

const HELP = `stuntdouble — shadow Jev with local decision models and find out if you can swap.

Usage
  stuntdouble serve   [--config stuntdouble.json] [--listen 8010] [--no-state] [--sample 1.0]
  stuntdouble report  <records.jsonl...> [--config f] [--max-disagreement 0.02] [--min-rows 20] [--noul-threshold 0.5] [--out report.md] [--json report.json]
  stuntdouble replay  <records.jsonl...> --double name=url[,model] [--out records/replay.jsonl]
  stuntdouble suite import <kev|jevbench|semif|jbe> <path> [--out suites/name.jsonl]
  stuntdouble suite run <suite.jsonl|jbe:path> [--config f] [--star name=url[,model]] [--double name=url[,model]]... [--sample N] [--out records/x.jsonl] [--no-state]

Flags
  --config FILE   JSON config: { listen, star: {name,url,model,headers,pricePerMillionInput}, doubles: [...], records, sampleRate }
  --no-state      Store only the request hash, not the state text
  --double n=u,m  A backend on the /v1/systemone wire shape; repeatable
  --timeout MS    Per-call timeout for --star/--double backends in suite run and replay (default 30000)
Config values may reference environment variables as \${NAME}. A .env in the working directory is loaded.`;

function parse(argv) {
  const positional = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const key = a.slice(2);
    if (['no-state', 'json-only'].includes(key)) { flags[key] = true; continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${a}`);
    if (key === 'double') (flags.double ??= []).push(value); else flags[key] = value;
  }
  return { positional, flags };
}

const backendFlag = (text, fallbackName, timeoutMs) => {
  const [head, model] = text.split(',');
  const eq = head.indexOf('=');
  const name = eq === -1 ? fallbackName : head.slice(0, eq), url = eq === -1 ? head : head.slice(eq + 1);
  if (!url) throw new Error(`Bad backend spec: ${text}. Use name=url[,model].`);
  return { name, url, ...(model ? { model } : {}), ...(timeoutMs ? { timeoutMs } : {}) };
};

async function loadConfig(flags, { required = true } = {}) {
  const path = flags.config ?? 'stuntdouble.json';
  if (!existsSync(path)) { if (required) throw new Error(`No config at ${path}. Create one or pass --config.`); return null; }
  const config = normalizeConfig(JSON.parse(await readFile(path, 'utf8')));
  if (flags.listen) config.listen = Number(flags.listen);
  if (flags.sample !== undefined && flags.sample <= 1) config.sampleRate = Number(flags.sample);
  if (flags['no-state']) config.redactState = true;
  return config;
}

function writeOut(path, text) { mkdirSync(dirname(resolve(path)), { recursive: true }); if (existsSync(path)) throw new Error(`${path} exists; choose a new name.`); writeFileSync(path, text); }

async function serve(flags) {
  const config = await loadConfig(flags);
  const recorder = createRecorder(config.records);
  const server = createProxy(config, { recorder, log: line => console.error(line) });
  server.listen(config.listen, () => {
    console.error(`stuntdouble listening on http://127.0.0.1:${config.listen}/v1/systemone`);
    console.error(`star: ${config.star.name} → ${config.star.url}   doubles: ${config.doubles.map(d => `${d.name} → ${d.url}`).join(', ') || 'none'}`);
    console.error(`records: ${resolve(config.records)}${config.redactState ? ' (state redacted)' : ''}`);
  });
  const stop = async () => { server.close(); await server.drain(); recorder.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

async function report(positional, flags) {
  if (!positional.length) throw new Error('report needs at least one records file.');
  const config = await loadConfig(flags, { required: false });
  const records = await readRecords(positional);
  if (!records.length) throw new Error('No records found.');
  const json = buildReport(records, { config, maxDisagreement: Number(flags['max-disagreement'] ?? 0.02), minRows: Number(flags['min-rows'] ?? 20), noulThreshold: Number(flags['noul-threshold'] ?? 0.5) });
  if (flags.json) writeOut(flags.json, JSON.stringify(json, null, 2) + '\n');
  const md = renderMarkdown(json);
  if (flags.out) { writeOut(flags.out, md); console.error(`wrote ${flags.out}`); } else process.stdout.write(md);
}

// Run every recorded request against new doubles. The star's recorded answer is kept.
async function replay(positional, flags) {
  if (!positional.length || !flags.double?.length) throw new Error('replay needs records files and at least one --double.');
  const records = await readRecords(positional);
  const doubles = flags.double.map((d, i) => createBackend(backendFlag(d, `double${i + 1}`, Number(flags.timeout) || 0)));
  const out = flags.out ?? `records/replay-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jsonl`;
  const lines = [];
  let done = 0;
  for (const r of records) {
    if (!r.request?.questions || r.request.state === null) continue;
    const copy = structuredClone(r);
    copy.replay = true;
    for (const d of doubles) { const res = await d.call(r.request); copy.doubles[d.name] = { name: d.name, status: res.status, model: res.model, answers: res.answers, usage: res.usage, elapsedMs: res.elapsedMs, error: res.error }; }
    lines.push(JSON.stringify(copy));
    if (++done % 25 === 0) console.error(`${done}/${records.length}`);
  }
  writeOut(out, lines.join('\n') + '\n');
  console.error(`replayed ${done} records → ${out}`);
}

async function suiteImport(positional, flags) {
  const [kind, path] = positional;
  const importer = IMPORTERS[kind];
  if (!importer || !path) throw new Error(`suite import <${Object.keys(IMPORTERS).join('|')}> <path>`);
  if (kind === 'jbe') throw new Error('jev-by-example is a policy suite; run it directly: stuntdouble suite run jbe:<path>');
  const items = await importer(path);
  const out = flags.out ?? `suites/${kind}.jsonl`;
  writeOut(out, items.map(i => JSON.stringify(i)).join('\n') + '\n');
  console.error(`imported ${items.length} items → ${out}`);
}

async function suiteRun(positional, flags) {
  const [source] = positional;
  if (!source) throw new Error('suite run needs a suite file or jbe:<path>.');
  const config = await loadConfig(flags, { required: false });
  const timeoutMs = Number(flags.timeout) || 0;
  const starSpec = flags.star ? backendFlag(flags.star, 'star', timeoutMs) : config?.star;
  if (!starSpec) throw new Error('Pass --star name=url or a config with star.');
  const doubleSpecs = flags.double?.length ? flags.double.map((d, i) => backendFlag(d, `double${i + 1}`, timeoutMs)) : config?.doubles ?? [];
  const star = createBackend(starSpec), doubles = doubleSpecs.map(s => createBackend(s));
  let items = source.startsWith('jbe:') ? await IMPORTERS.jbe(source.slice(4)) : await loadSuite(source);
  if (flags.sample && Number(flags.sample) > 1) items = sample(items, Number(flags.sample));
  const out = flags.out ?? `records/suite-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jsonl`;
  const lines = [];
  let n = 0;
  for (const item of items) {
    const request = { model: starSpec.model ?? 'jev-latest', ...item.request };
    const [starResult, ...doubleResults] = await Promise.all([star.call(request), ...doubles.map(d => d.call(request))]);
    const record = makeRecord({ request, label: item.label ?? null, star: starResult, doubles: Object.fromEntries(doubleResults.map(r => [r.name, r])), redactState: Boolean(flags['no-state'] || config?.redactState) });
    record.suite = { id: item.id, ...(item.meta ?? {}) };
    if (item.policy) {
      const run = (res) => { if (res.error || !res.answers) return { error: res.error ?? 'no answers' }; try { const d = item.policy.decide(res.answers); const { action, reason, ...details } = d; return { action, details: Object.keys(details).length ? details : null }; } catch (e) { return { error: e.message }; } };
      record.policy = { case: item.id, expected: item.policy.expected, star: run(starResult), doubles: Object.fromEntries(doubleResults.map(r => [r.name, run(r)])) };
    }
    lines.push(JSON.stringify(record));
    n++;
    console.error(`${n}/${items.length} ${item.id}: star=${starResult.error ?? starResult.status} ${starResult.elapsedMs}ms ` + doubleResults.map(r => `${r.name}=${r.error ?? r.status} ${r.elapsedMs}ms`).join(' '));
  }
  writeOut(out, lines.join('\n') + '\n');
  console.error(`wrote ${n} records → ${out}`);
}

export async function main(argv = process.argv.slice(2)) {
  if (existsSync('.env')) loadEnvFile('.env');
  const parsed = parse(argv);
  if (parsed.help || !parsed.positional?.length) { console.log(HELP); return; }
  const [command, sub, ...rest] = parsed.positional;
  if (command === 'serve') return serve(parsed.flags);
  if (command === 'report') return report(parsed.positional.slice(1), parsed.flags);
  if (command === 'replay') return replay(parsed.positional.slice(1), parsed.flags);
  if (command === 'suite' && sub === 'import') return suiteImport(rest, parsed.flags);
  if (command === 'suite' && sub === 'run') return suiteRun(rest, parsed.flags);
  throw new Error(`Unknown command: ${[command, sub].filter(Boolean).join(' ')}. Use --help.`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href.replace(/\/$/, '')) {
  main().catch(error => { console.error(error.message); process.exit(1); });
}
