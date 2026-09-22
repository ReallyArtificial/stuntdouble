import { validateResponse } from './contract.mjs';

const HOP_BY_HOP = new Set(['host', 'content-length', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'accept-encoding']);

export function substituteEnv(value, env = process.env) {
  if (typeof value === 'string') return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => {
    if (env[name] === undefined) throw new Error(`Config references ${name} but it is not set in the environment.`);
    return env[name];
  });
  if (Array.isArray(value)) return value.map(v => substituteEnv(v, env));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substituteEnv(v, env)]));
  return value;
}

export function normalizeConfig(raw, env = process.env) {
  const config = substituteEnv(structuredClone(raw), env);
  if (!config.star?.url) throw new Error('Config needs star.url');
  config.star.name ??= 'star';
  config.doubles ??= [];
  const names = new Set([config.star.name]);
  for (const d of config.doubles) {
    if (!d.url || !d.name) throw new Error('Each double needs name and url');
    if (names.has(d.name)) throw new Error(`Duplicate backend name: ${d.name}`);
    names.add(d.name);
  }
  config.listen ??= 8010;
  config.records ??= './records';
  config.sampleRate ??= 1;
  config.timeoutMs ??= 30_000;
  return config;
}

export function forwardHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  return out;
}

// One backend kind: anything that speaks POST {url}/v1/systemone with the TypeSafe wire shape.
// Returns the raw bytes plus a parsed, validated view. Never throws on HTTP or contract problems.
export function createBackend(spec, { fetchImpl = globalThis.fetch } = {}) {
  const endpoint = spec.url.replace(/\/+$/, '') + '/v1/systemone';
  return {
    name: spec.name, spec,
    async call(request, { headers = {}, timeoutMs = spec.timeoutMs ?? 30_000, rewriteModel = true } = {}) {
      const body = rewriteModel && spec.model ? { ...request, model: spec.model } : request;
      const start = performance.now();
      const result = { name: spec.name, status: null, model: null, answers: null, usage: null, elapsedMs: null, error: null, bytes: null, headers: null };
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST', redirect: 'error',
          headers: { ...headers, ...(spec.headers ?? {}), 'content-type': 'application/json' },
          body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
        });
        result.bytes = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        result.elapsedMs = Math.round(performance.now() - start);
        result.error = error?.name === 'TimeoutError' ? 'timeout' : `transport: ${error?.name ?? 'error'}`;
        return result;
      }
      result.elapsedMs = Math.round(performance.now() - start);
      result.status = response.status;
      result.headers = Object.fromEntries(response.headers.entries());
      if (!response.ok) { result.error = `http ${response.status}`; return result; }
      let parsed;
      try { parsed = JSON.parse(result.bytes.toString('utf8')); } catch { result.error = 'invalid json'; return result; }
      try { validateResponse(parsed, request.questions); } catch (error) { result.error = error.message; return result; }
      result.model = typeof parsed.model === 'string' ? parsed.model : null;
      result.answers = parsed.answers;
      result.usage = parsed.usage ?? null;
      return result;
    },
  };
}
