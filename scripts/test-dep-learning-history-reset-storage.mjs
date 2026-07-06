import assert from 'node:assert/strict';

import { buildLearningHistoryResetPlan } from '../dep-quiz-app/learning-history-reset.js';
import { commitLearningHistoryReset, STORAGE_KEYS } from '../dep-quiz-app/storage.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function createStorage({ initial = {}, fail = {} } = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];

  return {
    calls,
    getItem(key) {
      calls.push(['getItem', key]);
      if (fail.getItem?.(key)) throw new Error(`getItem failed: ${key}`);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.push(['setItem', key, value]);
      if (fail.setItem?.(key, value)) throw new Error(`setItem failed: ${key}`);
      values.set(key, String(value));
    },
    removeItem(key) {
      calls.push(['removeItem', key]);
      if (fail.removeItem?.(key)) throw new Error(`removeItem failed: ${key}`);
      values.delete(key);
    },
    raw(key) {
      return values.has(key) ? values.get(key) : null;
    },
  };
}

function samplePlan({ shouldClear = true } = {}) {
  return buildLearningHistoryResetPlan(
    {
      Q1: {
        seenCount: 1,
        correctCount: 0,
        wrongCount: 1,
        lastAnsweredAt: '2026-07-06T00:00:00.000Z',
        noteText: 'keep',
      },
    },
    { activeSession: shouldClear ? { questionId: 'Q1' } : null }
  );
}

test('saves next progress then clears active session when plan requires clearing', () => {
  const plan = samplePlan({ shouldClear: true });
  const storage = createStorage({
    initial: {
      [STORAGE_KEYS.progress]: '{"old":true}',
      [STORAGE_KEYS.session]: '{"questionId":"Q1"}',
      [STORAGE_KEYS.settings]: '{"mode":"normal"}',
    },
  });

  const result = commitLearningHistoryReset(plan, { storage });

  assert.deepEqual(result, { nextProgress: plan.nextProgress, didClearActiveSession: true });
  assert.equal(storage.raw(STORAGE_KEYS.progress), JSON.stringify(plan.nextProgress));
  assert.equal(storage.raw(STORAGE_KEYS.session), null);
  assert.equal(storage.raw(STORAGE_KEYS.settings), '{"mode":"normal"}');
  assert.deepEqual(storage.calls, [
    ['getItem', STORAGE_KEYS.progress],
    ['getItem', STORAGE_KEYS.session],
    ['setItem', STORAGE_KEYS.progress, JSON.stringify(plan.nextProgress)],
    ['removeItem', STORAGE_KEYS.session],
  ]);
});

test('does not touch active session or settings when shouldClear is false', () => {
  const plan = samplePlan({ shouldClear: false });
  const storage = createStorage({
    initial: {
      [STORAGE_KEYS.progress]: '{"old":true}',
      [STORAGE_KEYS.session]: '{"questionId":"Q2"}',
      [STORAGE_KEYS.settings]: '{"count":"50"}',
    },
  });

  const result = commitLearningHistoryReset(plan, { storage });

  assert.deepEqual(result, { nextProgress: plan.nextProgress, didClearActiveSession: false });
  assert.equal(storage.raw(STORAGE_KEYS.session), '{"questionId":"Q2"}');
  assert.equal(storage.raw(STORAGE_KEYS.settings), '{"count":"50"}');
  assert.deepEqual(
    storage.calls.map((call) => [call[0], call[1]]),
    [
      ['getItem', STORAGE_KEYS.progress],
      ['setItem', STORAGE_KEYS.progress],
    ]
  );
});

test('rejects invalid plans before touching storage', () => {
  for (const plan of [
    null,
    [],
    {},
    { nextProgress: [] },
    { nextProgress: {}, activeSession: {} },
  ]) {
    const storage = createStorage();
    assert.throws(() => commitLearningHistoryReset(plan, { storage }), TypeError);
    assert.deepEqual(storage.calls, []);
  }
});

test('does not write when raw snapshot acquisition fails', () => {
  const storage = createStorage({ fail: { getItem: (key) => key === STORAGE_KEYS.progress } });

  assert.throws(() => commitLearningHistoryReset(samplePlan(), { storage }), /getItem failed/);
  assert.deepEqual(storage.calls, [['getItem', STORAGE_KEYS.progress]]);
});

test('restores progress and does not clear session when progress save fails', () => {
  const originalProgress = '{"old":true}';
  const originalSession = '{"questionId":"Q1"}';
  const storage = createStorage({
    initial: { [STORAGE_KEYS.progress]: originalProgress, [STORAGE_KEYS.session]: originalSession },
    fail: { setItem: (key, value) => key === STORAGE_KEYS.progress && value !== originalProgress },
  });

  assert.throws(
    () => commitLearningHistoryReset(samplePlan(), { storage }),
    (error) => {
      assert.match(error.message, /Failed to save/);
      assert.equal(error.cause.message, `setItem failed: ${STORAGE_KEYS.progress}`);
      assert.deepEqual(error.restoreFailures, []);
      return true;
    }
  );
  assert.equal(storage.raw(STORAGE_KEYS.progress), originalProgress);
  assert.equal(storage.raw(STORAGE_KEYS.session), originalSession);
  assert.equal(
    storage.calls.some((call) => call[0] === 'removeItem' && call[1] === STORAGE_KEYS.session),
    false
  );
});

test('restores progress and session when session removal fails', () => {
  const originalProgress = '{"old":true}';
  const originalSession = '{"questionId":"Q1"}';
  const storage = createStorage({
    initial: { [STORAGE_KEYS.progress]: originalProgress, [STORAGE_KEYS.session]: originalSession },
    fail: { removeItem: (key) => key === STORAGE_KEYS.session },
  });

  assert.throws(
    () => commitLearningHistoryReset(samplePlan(), { storage }),
    (error) => {
      assert.match(error.message, /Failed to clear/);
      assert.equal(error.cause.message, `removeItem failed: ${STORAGE_KEYS.session}`);
      assert.deepEqual(error.restoreFailures, []);
      return true;
    }
  );
  assert.equal(storage.raw(STORAGE_KEYS.progress), originalProgress);
  assert.equal(storage.raw(STORAGE_KEYS.session), originalSession);
});

test('restores absent progress with removeItem when save fails after partial write', () => {
  const storage = createStorage({
    fail: {
      setItem: (key, value) => {
        if (key !== STORAGE_KEYS.progress || value === '{"partial":true}') return false;
        storage.setItem(STORAGE_KEYS.progress, '{"partial":true}');
        return true;
      },
    },
  });

  assert.throws(() => commitLearningHistoryReset(samplePlan({ shouldClear: false }), { storage }));
  assert.equal(storage.raw(STORAGE_KEYS.progress), null);
  assert.deepEqual(storage.calls.at(-1), ['removeItem', STORAGE_KEYS.progress]);
});

test('reports restore failures without losing original failure cause', () => {
  const originalProgress = '{"old":true}';
  const storage = createStorage({
    initial: {
      [STORAGE_KEYS.progress]: originalProgress,
      [STORAGE_KEYS.session]: '{"questionId":"Q1"}',
    },
    fail: {
      removeItem: (key) => key === STORAGE_KEYS.session,
      setItem: (key, value) => key === STORAGE_KEYS.progress && value === originalProgress,
    },
  });

  assert.throws(
    () => commitLearningHistoryReset(samplePlan(), { storage }),
    (error) => {
      assert.equal(error.cause.message, `removeItem failed: ${STORAGE_KEYS.session}`);
      assert.equal(error.restoreFailures.length, 1);
      assert.equal(error.restoreFailures[0].key, STORAGE_KEYS.progress);
      assert.equal(
        error.restoreFailures[0].error.message,
        `setItem failed: ${STORAGE_KEYS.progress}`
      );
      return true;
    }
  );
});

test('does not mutate plan or nextProgress', () => {
  const plan = samplePlan();
  const before = JSON.stringify(plan);
  const nextProgress = plan.nextProgress;
  const storage = createStorage();

  commitLearningHistoryReset(plan, { storage });

  assert.equal(JSON.stringify(plan), before);
  assert.equal(plan.nextProgress, nextProgress);
});
