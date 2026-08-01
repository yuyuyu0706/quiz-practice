import assert from 'node:assert/strict';
import { buildLearningHistoryResetPlan } from '../dep-quiz-app/learning-history-reset.js';
import { commitLearningHistoryReset, STORAGE_KEYS } from '../dep-quiz-app/storage.js';

function makeStorage(initial, fail = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    getItem(k) {
      calls.push(['get', k]);
      if (fail.get === k) throw Error('get');
      return values.get(k) ?? null;
    },
    setItem(k, v) {
      calls.push(['set', k, v]);
      if (fail.set === k && String(v) !== initial[k]) throw Error('set');
      values.set(k, String(v));
    },
    removeItem(k) {
      calls.push(['remove', k]);
      if (fail.remove === k) throw Error('remove');
      values.delete(k);
    },
    raw: (k) => values.get(k) ?? null,
  };
}
function plan(
  session = true,
  history = { version: 1, attempts: [{ id: 'ignored' }] },
  status = 'ready'
) {
  return buildLearningHistoryResetPlan(
    { Q: { seenCount: 1, noteText: 'keep' } },
    {
      activeSession: session ? { id: 1 } : null,
      confidenceHistory: history,
      confidenceHistoryStorageStatus: status,
    }
  );
}
const oldP = '{"old":true}',
  oldH = '{ "version": 2, "future": true }',
  oldS = '{"id":1}';
{
  const p = plan(true, null, 'unsupported');
  const s = makeStorage({
    [STORAGE_KEYS.progress]: oldP,
    [STORAGE_KEYS.confidenceHistory]: oldH,
    [STORAGE_KEYS.session]: oldS,
    [STORAGE_KEYS.settings]: '{"keep":true}',
  });
  const result = commitLearningHistoryReset(p, { storage: s });
  assert.deepEqual(result, {
    nextProgress: p.nextProgress,
    nextHistory: p.nextHistory,
    didClearConfidenceHistory: true,
    didClearActiveSession: true,
  });
  assert.deepEqual(
    s.calls.map((x) => x.slice(0, 2)),
    [
      ['get', STORAGE_KEYS.progress],
      ['get', STORAGE_KEYS.confidenceHistory],
      ['get', STORAGE_KEYS.session],
      ['set', STORAGE_KEYS.progress],
      ['set', STORAGE_KEYS.confidenceHistory],
      ['remove', STORAGE_KEYS.session],
    ]
  );
  assert.equal(s.raw(STORAGE_KEYS.settings), '{"keep":true}');
}
{
  const p = plan();
  const s = makeStorage(
    {
      [STORAGE_KEYS.progress]: oldP,
      [STORAGE_KEYS.confidenceHistory]: oldH,
      [STORAGE_KEYS.session]: oldS,
    },
    { set: STORAGE_KEYS.confidenceHistory }
  );
  assert.throws(
    () => commitLearningHistoryReset(p, { storage: s }),
    (e) => e.cause.message === 'set' && e.restoreFailures.length === 0
  );
  assert.equal(s.raw(STORAGE_KEYS.progress), oldP);
  assert.equal(s.raw(STORAGE_KEYS.confidenceHistory), oldH);
  assert.equal(s.raw(STORAGE_KEYS.session), oldS);
}
{
  const p = plan();
  const s = makeStorage(
    {
      [STORAGE_KEYS.progress]: oldP,
      [STORAGE_KEYS.confidenceHistory]: oldH,
      [STORAGE_KEYS.session]: oldS,
    },
    { remove: STORAGE_KEYS.session }
  );
  assert.throws(
    () => commitLearningHistoryReset(p, { storage: s }),
    (e) => e.cause.message === 'remove'
  );
  assert.equal(s.raw(STORAGE_KEYS.progress), oldP);
  assert.equal(s.raw(STORAGE_KEYS.confidenceHistory), oldH);
  assert.equal(s.raw(STORAGE_KEYS.session), oldS);
}
{
  const s = makeStorage({});
  assert.throws(() => commitLearningHistoryReset({}, { storage: s }), TypeError);
  assert.deepEqual(s.calls, []);
}
console.log('✓ learning history reset three-target transaction');
