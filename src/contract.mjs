// Wire-shape validation for /v1/systemone requests and responses.
// Adapted from ReallyArtificial/jev-by-example (MIT). Usage is optional here because
// local backends (sidecars) may not count tokens.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, message) => { if (!condition) throw new Error(`contract: ${message}`); };
const unit = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const sameKeys = (a, b) => a.length === b.length && a.every(key => b.includes(key));

export function validateRequest(request) {
  assert(object(request), 'request must be an object');
  assert(typeof request.state === 'string' || object(request.state) || Array.isArray(request.state), 'state must be text, object, or array');
  assert(object(request.questions) && Object.keys(request.questions).length > 0, 'questions required');
  for (const [id, q] of Object.entries(request.questions)) {
    assert(object(q) && ['noul', 'choice', 'score'].includes(q.type), `${id}: unsupported question type`);
    if (q.type === 'choice') assert(object(q.criteria) && Object.keys(q.criteria).length >= 2, `${id}: choice needs at least 2 criteria`);
    if (q.type === 'score') assert(Array.isArray(q.criteria) && q.criteria.length >= 2, `${id}: score needs at least 2 levels`);
  }
  return request;
}

export function answerKeys(question) {
  if (question.type === 'noul') return ['yes', 'no'];
  return question.type === 'choice' ? Object.keys(question.criteria) : question.criteria.map((_, i) => String(i));
}

export function validateResponse(response, questions) {
  assert(object(response), 'response must be an object');
  assert(object(response.answers), 'answers required');
  assert(sameKeys(Object.keys(response.answers), Object.keys(questions)), 'answer IDs must match question IDs');
  if (response.usage !== undefined && response.usage !== null) {
    assert(object(response.usage), 'usage must be an object');
    for (const key of ['input_tokens', 'output_tokens']) assert(response.usage[key] === undefined || (Number.isSafeInteger(response.usage[key]) && response.usage[key] >= 0), `invalid usage.${key}`);
  }
  for (const [id, q] of Object.entries(questions)) {
    const a = response.answers[id];
    assert(object(a) && a.type === q.type, `${id}: answer type mismatch`);
    if (q.type === 'noul') { assert(unit(a.noul), `${id}: noul outside [0,1]`); continue; }
    const keys = answerKeys(q);
    assert(object(a.probabilities) && sameKeys(Object.keys(a.probabilities), keys), `${id}: probability keys mismatch`);
    assert(Object.values(a.probabilities).every(unit), `${id}: invalid probability`);
    const sum = Object.values(a.probabilities).reduce((x, y) => x + y, 0);
    // Backends round each probability (Kev to two decimals), so the allowed drift grows with the option count.
    assert(Math.abs(sum - 1) <= 0.01 + 0.005 * keys.length, `${id}: probabilities must sum to one`);
    if (a.confidence !== undefined) assert(unit(a.confidence), `${id}: invalid confidence`);
    if (q.type === 'choice') {
      assert(keys.includes(a.choice), `${id}: unknown choice`);
      assert(a.probabilities[a.choice] >= Math.max(...Object.values(a.probabilities)) - 0.011, `${id}: choice is not a maximum`);
    } else {
      assert(typeof a.score === 'number' && Number.isFinite(a.score) && a.score >= -0.01 && a.score <= keys.length - 1 + 0.01, `${id}: invalid score`);
      const mean = keys.reduce((total, key) => total + Number(key) * a.probabilities[key], 0);
      // Rounded per-level probabilities shift the mean by up to 0.005 × Σ level index.
      assert(Math.abs(a.score - mean) <= 0.02 + 0.005 * keys.length * (keys.length - 1) / 2, `${id}: score inconsistent with distribution`);
    }
  }
  return response;
}
