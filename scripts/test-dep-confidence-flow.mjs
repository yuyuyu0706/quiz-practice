import assert from 'node:assert/strict';

import { normalizeConfidenceLevel } from '../dep-quiz-app/confidence.js';
import { buildLearningHistoryResetPlan } from '../dep-quiz-app/learning-history-reset.js';
import { applyConfidenceAnswerResult, normalizeProgressEntry } from '../dep-quiz-app/progress.js';
import {
  createSession,
  getStoredConfidenceLevel,
  normalizeLoadedSession,
  SESSION_SCHEMA_VERSION,
  setSessionConfidenceLevel,
} from '../dep-quiz-app/quiz-session.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function roundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test('confidence flows through a restored session into an immutable progress update', () => {
  const session = createSession(['Q1', 'Q2'], 'normal', { count: 'all' });
  setSessionConfidenceLevel(session, 'Q1', 'high');
  const restored = normalizeLoadedSession(roundTrip(session));
  const confidence = getStoredConfidenceLevel(restored, 'Q1');
  const progress = {
    Q1: {
      bookmark: true,
      noteText: 'keep note',
      note: 'keep note',
      memo: 'legacy note',
      wrongReasonTags: ['careless-mistake'],
      compatibilityField: 'keep',
      futureField: { keep: true },
    },
    Q2: { seenCount: 4, futureField: 'other question' },
  };
  const original = structuredClone(progress);

  const updated = applyConfidenceAnswerResult(progress, 'Q1', {
    result: 'correct',
    confidence,
    answeredAt: '2026-07-25T01:02:03.000Z',
  });

  assert.equal(normalizeConfidenceLevel('high'), 'high');
  assert.equal(updated.Q1.seenCount, 1);
  assert.equal(updated.Q1.correctCount, 1);
  assert.equal(updated.Q1.wrongCount, 0);
  assert.deepEqual(updated.Q1.lastConfidenceAnswer, {
    result: 'correct',
    confidence: 'high',
    answeredAt: '2026-07-25T01:02:03.000Z',
  });
  assert.equal(updated.Q1.lastAnsweredAt, updated.Q1.lastConfidenceAnswer.answeredAt);
  assert.equal(updated.Q1.bookmark, true);
  assert.equal(updated.Q1.noteText, 'keep note');
  assert.equal(updated.Q1.memo, 'legacy note');
  assert.deepEqual(updated.Q1.wrongReasonTags, ['careless-mistake']);
  assert.equal(updated.Q1.compatibilityField, 'keep');
  assert.deepEqual(updated.Q1.futureField, { keep: true });
  assert.equal(updated.Q2, progress.Q2);
  assert.deepEqual(progress, original);
  assert.equal(restored.confidenceByQuestion.Q1, 'high');
});

test('a second answer accumulates counts and only replaces the latest assessment', () => {
  const legacyEntry = {
    seenCount: 0,
    note: 'legacy note',
    bookmark: true,
    unknown: 42,
  };
  const first = applyConfidenceAnswerResult({ Q1: legacyEntry }, 'Q1', {
    result: 'wrong',
    confidence: 'high',
    answeredAt: '2026-07-25T02:00:00Z',
  });
  const second = applyConfidenceAnswerResult(first, 'Q1', {
    result: 'correct',
    confidence: 'medium',
    answeredAt: '2026-07-25T03:00:00.000Z',
  });

  assert.equal(second.Q1.seenCount, 2);
  assert.equal(second.Q1.correctCount, 1);
  assert.equal(second.Q1.wrongCount, 1);
  assert.deepEqual(second.Q1.lastConfidenceAnswer, {
    result: 'correct',
    confidence: 'medium',
    answeredAt: '2026-07-25T03:00:00.000Z',
  });
  assert.equal(second.Q1.lastAnsweredAt, second.Q1.lastConfidenceAnswer.answeredAt);
  assert.equal(second.Q1.note, 'legacy note');
  assert.equal(second.Q1.bookmark, true);
  assert.equal(second.Q1.unknown, 42);
  assert.equal(Object.hasOwn(second.Q1, 'answerHistory'), false);
  assert.deepEqual(legacyEntry, {
    seenCount: 0,
    note: 'legacy note',
    bookmark: true,
    unknown: 42,
  });
});

test('legacy and interrupted sessions migrate without losing unrelated data', () => {
  const legacy = {
    schemaVersion: 1,
    app: 'dep-quiz-app',
    mode: 'normal',
    order: ['Q1'],
    currentIndex: 0,
    answers: { Q1: 'B' },
    choiceMap: { Q1: { A: 'B', B: 'A' } },
    graded: { Q1: false },
    unknown: { keep: true },
  };
  const migrated = normalizeLoadedSession(roundTrip(legacy));

  assert.equal(migrated.schemaVersion, SESSION_SCHEMA_VERSION);
  assert.deepEqual(migrated.confidenceByQuestion, {});
  assert.deepEqual(migrated.answers, legacy.answers);
  assert.deepEqual(migrated.choiceMap, legacy.choiceMap);
  assert.deepEqual(migrated.graded, legacy.graded);
  assert.deepEqual(migrated.unknown, { keep: true });
  assert.equal(getStoredConfidenceLevel(migrated, 'Q1'), null);
  assert.deepEqual(legacy, {
    schemaVersion: 1,
    app: 'dep-quiz-app',
    mode: 'normal',
    order: ['Q1'],
    currentIndex: 0,
    answers: { Q1: 'B' },
    choiceMap: { Q1: { A: 'B', B: 'A' } },
    graded: { Q1: false },
    unknown: { keep: true },
  });
});

test('session restore drops confidence outside the order and all invalid stored values', () => {
  for (const invalid of ['HIGH', '自信あり', ' high ', '', null]) {
    const restored = normalizeLoadedSession({
      ...createSession(['Q1'], 'normal', null),
      confidenceByQuestion: { Q1: invalid, Q2: 'low' },
    });
    assert.deepEqual(restored.confidenceByQuestion, {});
    assert.equal(getStoredConfidenceLevel(restored, 'Q1'), null);
  }
  const invalidMap = normalizeLoadedSession({
    ...createSession(['Q1'], 'normal', null),
    confidenceByQuestion: ['high'],
  });
  assert.deepEqual(invalidMap.confidenceByQuestion, {});
});

test('invalid answer fields are rejected rather than normalized for writing', () => {
  const valid = {
    result: 'correct',
    confidence: 'high',
    answeredAt: '2026-07-25T04:00:00.000Z',
  };
  for (const answer of [
    { ...valid, result: 'Correct' },
    { ...valid, confidence: 'HIGH' },
    { ...valid, confidence: ' high ' },
    { ...valid, answeredAt: '2026-07-25T04:00:00+00:00' },
    { ...valid, answeredAt: '2026-02-30T04:00:00.000Z' },
  ]) {
    assert.throws(() => applyConfidenceAnswerResult({}, 'Q1', answer), TypeError);
  }
});

test('normalization safely handles legacy and mismatched confidence progress', () => {
  const legacy = normalizeProgressEntry({ note: 'old', future: 'keep' });
  assert.equal(legacy.lastConfidenceAnswer, null);
  assert.equal(legacy.noteText, 'old');
  assert.equal(legacy.future, 'keep');

  const mismatched = normalizeProgressEntry({
    lastAnsweredAt: '2026-07-25T05:00:00.000Z',
    lastConfidenceAnswer: {
      result: 'wrong',
      confidence: 'low',
      answeredAt: '2026-07-25T05:01:00.000Z',
    },
  });
  assert.equal(mismatched.lastConfidenceAnswer, null);
});

test('learning-history reset removes answer data and retains user-authored data', () => {
  const progress = {
    Q1: {
      seenCount: 2,
      correctCount: 1,
      wrongCount: 1,
      lastAnsweredAt: '2026-07-25T06:00:00.000Z',
      lastConfidenceAnswer: {
        result: 'correct',
        confidence: 'medium',
        answeredAt: '2026-07-25T06:00:00.000Z',
      },
      wrongReasonTags: ['careless-mistake'],
      wrongReasonUpdatedAt: '2026-07-25T05:00:00.000Z',
      noteText: 'keep',
      note: 'keep',
      bookmark: true,
      future: { keep: true },
    },
    Q2: {
      seenCount: 1,
      correctCount: 0,
      wrongCount: 1,
      lastAnsweredAt: '2026-07-25T06:00:00.000Z',
      lastConfidenceAnswer: {
        result: 'wrong',
        confidence: 'low',
        answeredAt: '2026-07-25T06:00:00.000Z',
      },
    },
  };
  const original = structuredClone(progress);
  const plan = buildLearningHistoryResetPlan(progress, { activeSession: { order: ['Q1'] } });

  assert.deepEqual(plan.nextProgress, {
    Q1: {
      noteText: 'keep',
      note: 'keep',
      bookmark: true,
      future: { keep: true },
    },
  });
  assert.equal(plan.activeSession.shouldClear, true);
  assert.equal(plan.impact.removedEntryCount, 1);
  assert.deepEqual(progress, original);
});
