import assert from 'node:assert/strict';
import { buildConfidenceHistoryRepairPlan } from '../dep-quiz-app/confidence-history-repair.js';
import {
  loadConfidenceHistoryState,
  commitConfidenceAnswer,
  STORAGE_KEYS,
} from '../dep-quiz-app/storage.js';

const attempt = (id, answeredAt = '2026-01-01T00:00:00.000Z') => ({
  attemptId: id,
  questionId: `Q-${id}`,
  section: '1',
  result: 'correct',
  confidence: 'high',
  answeredAt,
});
const storage = (raw = null) => {
  const values = new Map();
  if (raw !== null) values.set(STORAGE_KEYS.confidenceHistory, raw);
  const calls = [];
  return {
    calls,
    getItem(k) {
      calls.push(['get', k]);
      return values.get(k) ?? null;
    },
    setItem(k, v) {
      calls.push(['set', k, v]);
      values.set(k, String(v));
    },
    removeItem(k) {
      calls.push(['remove', k]);
      values.delete(k);
    },
    raw(key = STORAGE_KEYS.confidenceHistory) {
      return values.get(key) ?? null;
    },
  };
};

{
  const input = {
    version: 1,
    attempts: [attempt('b', '2026-01-02T00:00:00.000Z'), attempt('a'), attempt('a'), { bad: true }],
    extra: true,
  };
  const before = structuredClone(input);
  const plan = buildConfidenceHistoryRepairPlan(input);
  assert.equal(plan.status, 'repairable');
  assert.deepEqual(
    plan.nextHistory.attempts.map((x) => x.attemptId),
    ['a', 'b']
  );
  assert.equal(plan.removedAttemptCount, 2);
  assert.deepEqual(input, before);
}
{
  const s = storage();
  const state = loadConfidenceHistoryState({ storage: s });
  assert.equal(state.status, 'initialized');
  assert.deepEqual(JSON.parse(s.raw()), { version: 1, attempts: [] });
}
{
  const raw = JSON.stringify({ version: 1, attempts: [attempt('a')] });
  const s = storage(raw);
  const state = loadConfidenceHistoryState({ storage: s });
  assert.equal(state.status, 'ready');
  assert.equal(s.raw(), raw);
  assert.equal(s.calls.filter((x) => x[0] === 'set').length, 0);
}
{
  const s = storage('{bad');
  const state = loadConfidenceHistoryState({ storage: s });
  assert.equal(state.status, 'repaired');
  assert.deepEqual(JSON.parse(s.raw()), { version: 1, attempts: [] });
}
{
  const raw = '{ "version": 2, "attempts": [{"future":true}] }';
  const s = storage(raw);
  const state = loadConfidenceHistoryState({ storage: s });
  assert.equal(state.status, 'unsupported');
  assert.equal(state.unsupportedVersion, 2);
  assert.equal(s.raw(), raw);
}
{
  const future = JSON.stringify({ version: 2, attempts: [] });
  const s = storage(future);
  const plan = {
    attempt: attempt('x'),
    nextProgress: { Q: {} },
    nextHistory: { version: 1, attempts: [attempt('x')] },
    trimmedCount: 0,
  };
  assert.throws(
    () => commitConfidenceAnswer(plan, { storage: s }),
    (e) => e.code === 'UNSUPPORTED_CONFIDENCE_HISTORY_VERSION' && e.version === 2
  );
  assert.equal(s.raw(), future);
  assert.equal(s.raw(STORAGE_KEYS.progress), null);
  assert.equal(
    s.calls.some((x) => x[0] === 'set' && x[1] === STORAGE_KEYS.progress),
    false
  );
}
console.log('✓ confidence history repair and storage lifecycle');
