// Suite = JSONL of { id, request: { state, questions }, label: { [qid]: selected | { selected, distribution } }, meta }.
// Policy suites (jev-by-example) are loaded as modules and carry decide/baseline functions.
import { readFile, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

async function* jsonl(path) {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) { n++; if (line.trim()) { try { yield JSON.parse(line); } catch { throw new Error(`${path}:${n}: invalid JSON`); } } }
}

// Kev: rows are already the systemone request shape; each question carries `label` (and `src`).
export async function importKev(path) {
  const out = [];
  for await (const row of jsonl(path)) {
    const questions = {}, label = {};
    for (const [qid, q] of Object.entries(row.questions)) {
      const { label: l, src, ...question } = q;
      questions[qid] = question;
      if (l !== undefined) label[qid] = q.type === 'noul' ? (l === true || l === 'yes' || l === 1) : String(l);
    }
    out.push({ id: row._meta?.id ?? `kev/${out.length}`, request: { state: row.state, questions }, label, meta: { source: 'kev', src: row._meta?.source ?? null, group: row._meta?.group_id ?? null } });
  }
  return out;
}

// JevBench public items: one question per item, `expected` key, optional gold distribution.
export async function importJevbench(path) {
  const out = [];
  for await (const row of jsonl(path)) {
    const q = row.question;
    const label = { answer: row.distribution ? { selected: String(row.expected), distribution: row.distribution } : String(row.expected) };
    if (q.type === 'noul') label.answer = ['yes', 'true'].includes(String(row.expected).toLowerCase());
    out.push({ id: row.id, request: { state: row.state, questions: { answer: q } }, label, meta: { source: 'jevbench', family: row.family ?? null, group: row.group ?? null } });
  }
  return out;
}

// SemIf examples: single question with options[{id, description}] and no label.
export async function importSemif(path) {
  const out = [];
  for await (const row of jsonl(path)) {
    const criteria = Object.fromEntries(row.options.map(o => [o.id, o.description ?? null]));
    out.push({ id: row.id, request: { state: row.state, questions: { answer: { type: 'choice', instructions: row.question, criteria } } }, label: row.expected ? { answer: String(row.expected) } : null, meta: { source: 'semif' } });
  }
  return out;
}

// jev-by-example: import the examples as modules. Cases stopped by preflight are skipped
// (no model call would happen). Each item carries decide/baseline for policy agreement.
export async function importJbe(root) {
  const dir = resolve(root, 'examples');
  const names = (await readdir(dir, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort();
  const out = [];
  for (const name of names) {
    const { default: example } = await import(pathToFileURL(join(dir, name, 'example.mjs')).href);
    for (const c of example.cases) {
      if (example.preflight?.(c.state)) continue;
      const questions = example.questions(c.state, c);
      out.push({
        id: `${example.id}/${c.id}`, request: { state: c.state, questions }, label: null,
        meta: { source: 'jev-by-example', example: example.id, case: c.id, expected: c.expected, note: c.note },
        policy: { decide: (answers) => example.decide(c.state, answers), expected: { action: c.expected, ...(c.expectedDetails ?? {}) } },
      });
    }
  }
  return out;
}

export const IMPORTERS = { kev: importKev, jevbench: importJevbench, semif: importSemif, jbe: importJbe };

export async function loadSuite(path) {
  const items = [];
  for await (const row of jsonl(path)) items.push(row);
  return items;
}

export function sample(items, n, seed = 20260922) {
  if (!n || n >= items.length) return items;
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, n);
}

export async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
