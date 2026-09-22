import { mkdirSync, openSync, writeSync, fsyncSync, closeSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';

export const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Strip a backend result down to what a record stores.
export function stored(result) {
  if (!result) return null;
  const { name, status, model, answers, usage, elapsedMs, error } = result;
  return { name, status, model, answers, usage, elapsedMs, error };
}

export function makeRecord({ request, label = null, star, doubles = {}, redactState = false, replay = false }) {
  const record = {
    id: randomUUID(), ts: new Date().toISOString(),
    request: redactState ? { ...request, state: null } : request,
    requestSha256: sha256(request),
    label,
    star: stored(star),
    doubles: Object.fromEntries(Object.entries(doubles).map(([k, v]) => [k, stored(v)])),
  };
  if (replay) record.replay = true;
  return record;
}

// One JSONL file per UTC day. Each line is written and fsynced before append() resolves.
export function createRecorder(dir) {
  mkdirSync(dir, { recursive: true });
  let fd = null, day = null;
  return {
    path: () => join(dir, `${day}.jsonl`),
    append(record) {
      const today = record.ts.slice(0, 10);
      if (day !== today) { if (fd !== null) closeSync(fd); day = today; fd = openSync(join(dir, `${day}.jsonl`), 'a'); }
      writeSync(fd, JSON.stringify(record) + '\n');
      fsyncSync(fd);
      return record;
    },
    close() { if (fd !== null) closeSync(fd); fd = null; },
  };
}

export async function readRecords(paths) {
  const out = [];
  for (const path of paths) {
    const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    let line = 0;
    for await (const text of rl) {
      line++;
      if (!text.trim()) continue;
      try { out.push(JSON.parse(text)); } catch { throw new Error(`${path}:${line}: invalid JSON`); }
    }
  }
  return out;
}
