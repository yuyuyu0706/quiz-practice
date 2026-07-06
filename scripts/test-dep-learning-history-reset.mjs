import assert from 'node:assert/strict';

import { buildWeaknessAnalysis } from '../dep-quiz-app/analysis.js';
import { buildLearningHistoryResetPlan } from '../dep-quiz-app/learning-history-reset.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const learnedOnly = {
  seenCount: 2,
  correctCount: 1,
  wrongCount: 1,
  lastAnsweredAt: '2026-07-06T00:00:00.000Z',
  wrongReasonTags: ['careless-mistake'],
  wrongReasonUpdatedAt: '2026-07-06T00:01:00.000Z',
};

const defaultOnly = {
  seenCount: 0,
  correctCount: 0,
  wrongCount: 0,
  lastAnsweredAt: null,
  bookmark: false,
  noteText: '',
  note: '',
  memo: '',
  noteUpdatedAt: null,
  wrongReasonTags: [],
  wrongReasonUpdatedAt: null,
};

test('removes only answer history and wrong reason fields while retaining notes, bookmarks, and unknown fields', () => {
  const progress = {
    Q1: {
      ...learnedOnly,
      bookmark: true,
      noteText: ' Keep note ',
      note: 'legacy note',
      memo: 'legacy memo',
      noteUpdatedAt: '2026-07-05T00:00:00.000Z',
      futureField: { keep: true },
    },
  };

  const plan = buildLearningHistoryResetPlan(progress);

  assert.deepEqual(plan.nextProgress, {
    Q1: {
      bookmark: true,
      noteText: ' Keep note ',
      note: 'legacy note',
      memo: 'legacy memo',
      noteUpdatedAt: '2026-07-05T00:00:00.000Z',
      futureField: { keep: true },
    },
  });
  assert.equal(plan.impact.resetQuestionCount, 1);
  assert.equal(plan.impact.changedEntryCount, 1);
  assert.equal(plan.impact.retainedNoteCount, 1);
  assert.equal(plan.impact.retainedBookmarkCount, 1);
});

test('removes entries that have only reset targets or empty retained defaults', () => {
  const plan = buildLearningHistoryResetPlan({ learnedOnly, defaultOnly });

  assert.deepEqual(plan.nextProgress, {});
  assert.equal(plan.impact.resetQuestionCount, 1);
  assert.equal(plan.impact.changedEntryCount, 2);
  assert.equal(plan.impact.removedEntryCount, 2);
  assert.equal(plan.impact.retainedEntryCount, 0);
});

test('retains note-only, bookmark-only, unknown-only, and old question id entries', () => {
  const plan = buildLearningHistoryResetPlan({
    OLD_NOTE: { noteText: 'old note' },
    BOOKMARK: { bookmark: true },
    UNKNOWN: { futureField: null },
  });

  assert.deepEqual(plan.nextProgress, {
    OLD_NOTE: { noteText: 'old note' },
    BOOKMARK: { bookmark: true },
    UNKNOWN: { futureField: null },
  });
  assert.equal(plan.impact.retainedNoteCount, 1);
  assert.equal(plan.impact.retainedBookmarkCount, 1);
  assert.equal(plan.impact.retainedEntryCount, 3);
});

test('handles invalid root values and invalid entries without throwing or mutating them', () => {
  assert.deepEqual(buildLearningHistoryResetPlan(null).nextProgress, {});
  assert.deepEqual(buildLearningHistoryResetPlan([]).nextProgress, {});

  const progress = { STRING: 'keep', ARRAY: ['keep'] };
  const plan = buildLearningHistoryResetPlan(progress);

  assert.deepEqual(plan.nextProgress, progress);
  assert.equal(plan.impact.retainedEntryCount, 2);
});

test('does not mutate input progress or entries', () => {
  const progress = {
    Q1: { ...learnedOnly, noteText: 'keep' },
  };
  const before = deepClone(progress);

  buildLearningHistoryResetPlan(progress);

  assert.deepEqual(progress, before);
});

test('is idempotent for nextProgress and impact', () => {
  const first = buildLearningHistoryResetPlan({
    Q1: { ...learnedOnly, noteText: 'keep' },
    Q2: { ...learnedOnly },
    Q3: { bookmark: true },
  });
  const second = buildLearningHistoryResetPlan(first.nextProgress);

  assert.deepEqual(second.nextProgress, first.nextProgress);
  assert.deepEqual(second.impact, {
    resetQuestionCount: 0,
    changedEntryCount: 0,
    retainedNoteCount: 1,
    retainedBookmarkCount: 1,
    removedEntryCount: 0,
    retainedEntryCount: 2,
    hasActiveSession: false,
  });
});

test('reports all impact counts and active session clearing contract', () => {
  const plan = buildLearningHistoryResetPlan(
    {
      Q1: { ...learnedOnly, noteText: 'keep' },
      Q2: { ...learnedOnly },
      Q3: { bookmark: true },
      Q4: { wrongReasonTags: ['careless-mistake'] },
      Q5: { seenCount: 0 },
    },
    { activeSession: { questionId: 'Q1' } }
  );

  assert.deepEqual(plan.impact, {
    resetQuestionCount: 3,
    changedEntryCount: 4,
    retainedNoteCount: 1,
    retainedBookmarkCount: 1,
    removedEntryCount: 3,
    retainedEntryCount: 2,
    hasActiveSession: true,
  });
  assert.deepEqual(plan.activeSession, { shouldClear: true });
});

test('reset progress returns weakness analysis to unlearned history and no wrong reason tags', () => {
  const questions = [
    { id: 'Q1', section: '1', sectionTitle: 'Section 1' },
    { id: 'Q2', section: '1', sectionTitle: 'Section 1' },
  ];
  const progress = {
    Q1: { ...learnedOnly, noteText: 'keep' },
    Q2: {
      seenCount: 1,
      correctCount: 1,
      wrongCount: 0,
      lastAnsweredAt: '2026-07-06T00:00:00.000Z',
    },
  };

  const before = buildWeaknessAnalysis(questions, progress);
  const reset = buildLearningHistoryResetPlan(progress);
  const after = buildWeaknessAnalysis(questions, reset.nextProgress);

  assert.equal(before.overall.answeredQuestionCount, 2);
  assert.equal(before.overall.totalAttemptCount, 3);
  assert.equal(before.overall.taggedQuestionCount, 1);
  assert.equal(after.overall.answeredQuestionCount, 0);
  assert.equal(after.overall.totalAttemptCount, 0);
  assert.equal(after.overall.correctCount, 0);
  assert.equal(after.overall.wrongCount, 0);
  assert.equal(after.overall.taggedQuestionCount, 0);
});
