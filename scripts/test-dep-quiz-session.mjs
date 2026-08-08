import assert from 'node:assert/strict';

import {
  createQuizSession,
  createSession,
  getStoredConfidenceLevel,
  normalizeLoadedSession,
  setSessionConfidenceLevel,
} from '../dep-quiz-app/quiz-session.js';
import { createWeaknessReviewSession } from '../dep-quiz-app/weakness-review-session.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const settings = { sections: ['1'], count: 'all' };
const questions = [
  { id: 'Q1', section: '1' },
  { id: 'Q2', section: '1' },
];

test('creates schema version 2 sessions with an empty confidence map', () => {
  const session = createSession(['Q1'], 'normal', settings);
  assert.equal(session.schemaVersion, 2);
  assert.equal(session.app, 'dep-quiz-app');
  assert.deepEqual(session.confidenceByQuestion, {});
  assert.deepEqual(session.answers, {});
  assert.deepEqual(session.choiceMap, {});
  assert.deepEqual(session.graded, {});
  assert.equal(session.currentIndex, 0);
  assert.equal(session.completedAt, null);
  assert.equal(session.explanationOpen, false);
});

test('uses the version 2 contract in every quiz and weakness review mode', () => {
  const progress = { Q1: { wrongCount: 1, bookmark: true }, Q2: {} };
  for (const mode of ['normal', 'wrongOnly', 'bookmarks', 'notesOnly']) {
    const { session } = createQuizSession(
      questions,
      settings,
      mode,
      progress,
      (_progress, id) => id === 'Q1'
    );
    assert.equal(session.schemaVersion, 2);
    assert.deepEqual(session.confidenceByQuestion, {});
    assert.deepEqual(session.order, mode === 'normal' ? ['Q1', 'Q2'] : ['Q1']);
    assert.equal(session.settingsSnapshot.mode, mode);
  }

  const condition = { type: 'section', value: '1', label: 'Section 1' };
  const session = createWeaknessReviewSession({
    condition,
    targetCount: 2,
    items: [{ id: 'Q2' }, { id: 'Q1' }],
  });
  assert.equal(session.schemaVersion, 2);
  assert.deepEqual(session.confidenceByQuestion, {});
  assert.deepEqual(session.order, ['Q2', 'Q1']);
  assert.deepEqual(session.settingsSnapshot.condition, condition);
});

test('migrates version 1 while preserving session data and unknown properties', () => {
  const saved = {
    schemaVersion: 1,
    app: 'dea-quiz-app',
    mode: 'wrongOnly',
    order: ['Q1', 'Q2'],
    currentIndex: 1,
    answers: { Q1: 'A' },
    choiceMap: { Q1: { A: 'B' } },
    graded: { Q1: true },
    explanationOpen: true,
    startedAt: '2026-01-01T00:00:00.000Z',
    settingsSnapshot: { count: 2 },
    futureField: 'preserved',
  };
  const restored = normalizeLoadedSession(saved);
  assert.equal(restored.schemaVersion, 2);
  assert.equal(restored.app, 'dep-quiz-app');
  assert.deepEqual(restored.confidenceByQuestion, {});
  assert.deepEqual(restored.answers, saved.answers);
  assert.deepEqual(restored.choiceMap, saved.choiceMap);
  assert.deepEqual(restored.graded, saved.graded);
  assert.equal(restored.mode, 'wrongOnly');
  assert.deepEqual(restored.settingsSnapshot, { count: 2 });
  assert.equal(restored.futureField, 'preserved');
  assert.notEqual(restored.order, saved.order);
  assert.notEqual(restored.answers, saved.answers);
});

test('rejects completed and structurally invalid saved sessions', () => {
  assert.equal(normalizeLoadedSession({ order: [], currentIndex: 0 }), null);
  assert.equal(normalizeLoadedSession({ order: ['Q1'], currentIndex: -1 }), null);
  assert.equal(normalizeLoadedSession({ order: ['Q1'], currentIndex: 1 }), null);
  assert.equal(
    normalizeLoadedSession({ order: ['Q1'], currentIndex: 0, completedAt: 'now' }),
    null
  );
  assert.equal(normalizeLoadedSession([]), null);
});

test('keeps only exact confidence IDs for questions in the session', () => {
  const invalidValues = ['HIGH', ' high ', '確信あり', 1, true, [], {}];
  const confidenceByQuestion = { Q1: 'high', Q2: 'medium', outside: 'low' };
  invalidValues.forEach((value, index) => {
    confidenceByQuestion[`bad${index}`] = value;
  });
  const order = ['Q1', 'Q2', ...invalidValues.map((_, index) => `bad${index}`)];
  const restored = normalizeLoadedSession({ order, currentIndex: 0, confidenceByQuestion });
  assert.deepEqual(restored.confidenceByQuestion, { Q1: 'high', Q2: 'medium' });

  for (const invalidMap of [null, [], 'high']) {
    assert.deepEqual(
      normalizeLoadedSession({ order: ['Q1'], currentIndex: 0, confidenceByQuestion: invalidMap })
        .confidenceByQuestion,
      {}
    );
  }
});

test('gets confidence safely without mutating input', () => {
  const session = { confidenceByQuestion: { Q1: 'low', Q2: 'LOW' } };
  const before = JSON.stringify(session);
  assert.equal(getStoredConfidenceLevel(session, 'Q1'), 'low');
  assert.equal(getStoredConfidenceLevel(session, 'Q2'), null);
  assert.equal(getStoredConfidenceLevel(session, 'missing'), null);
  assert.equal(getStoredConfidenceLevel(null, 'Q1'), null);
  assert.equal(getStoredConfidenceLevel({}, 'Q1'), null);
  assert.equal(JSON.stringify(session), before);
});

test('sets and replaces confidence before grading without affecting other questions', () => {
  const session = createSession(['Q1', 'Q2'], 'normal', settings);
  setSessionConfidenceLevel(session, 'Q2', 'low');
  assert.equal(setSessionConfidenceLevel(session, 'Q1', 'high'), 'high');
  assert.equal(setSessionConfidenceLevel(session, 'Q1', 'medium'), 'medium');
  assert.deepEqual(session.confidenceByQuestion, { Q2: 'low', Q1: 'medium' });
});

test('rejects invalid writes and leaves existing confidence unchanged', () => {
  const session = createSession(['Q1'], 'normal', settings);
  session.confidenceByQuestion.Q1 = 'high';
  for (const value of ['HIGH', null, 1, {}]) {
    assert.throws(() => setSessionConfidenceLevel(session, 'Q1', value), TypeError);
  }
  for (const id of ['', '   ', null, 1]) {
    assert.throws(() => setSessionConfidenceLevel(session, id, 'low'), TypeError);
  }
  assert.throws(() => setSessionConfidenceLevel(session, 'outside', 'low'), RangeError);
  session.graded.Q1 = true;
  assert.throws(() => setSessionConfidenceLevel(session, 'Q1', 'low'));
  assert.deepEqual(session.confidenceByQuestion, { Q1: 'high' });
});

test('preserves valid session state through JSON round-trip and removes invalid confidence', () => {
  const session = createSession(['Q2', 'Q1'], 'bookmarks', { count: 2, mode: 'bookmarks' });
  session.answers.Q2 = 'B';
  session.confidenceByQuestion = { Q2: 'low', Q1: 'invalid', outside: 'high' };
  session.graded.Q2 = true;
  const restored = normalizeLoadedSession(JSON.parse(JSON.stringify(session)));
  assert.deepEqual(restored.order, ['Q2', 'Q1']);
  assert.deepEqual(restored.answers, { Q2: 'B' });
  assert.deepEqual(restored.confidenceByQuestion, { Q2: 'low' });
  assert.deepEqual(restored.graded, { Q2: true });
  assert.equal(restored.mode, 'bookmarks');
  assert.deepEqual(restored.settingsSnapshot, { count: 2, mode: 'bookmarks' });
});

test('collapses variants after mode eligibility and before count', () => {
  const variants = [
    { id: 'first', section: '1', variantGroup: 'group' },
    { id: 'independent', section: '1' },
    { id: 'winner', section: '1', variantGroup: 'group' },
    { id: 'outside', section: '2', variantGroup: 'group' },
  ];
  const progress = {
    first: { seenCount: 5, wrongCount: 1, bookmark: true, noteText: 'note' },
    winner: { seenCount: 1 },
    outside: { seenCount: 0 },
  };

  const normal = createQuizSession(variants, { sections: ['1'], count: 2 }, 'normal', progress);
  assert.deepEqual(
    normal.pool.map(({ id }) => id),
    ['winner', 'independent']
  );
  assert.deepEqual(normal.session.order, ['winner', 'independent']);

  for (const mode of ['wrongOnly', 'bookmarks', 'notesOnly']) {
    const result = createQuizSession(variants, settings, mode, progress, (entries, id) =>
      Boolean(entries[id]?.noteText)
    );
    assert.deepEqual(
      result.pool.map(({ id }) => id),
      ['first'],
      mode
    );
  }
});

test('uses stable variant ties and collapses before random shuffle', () => {
  const variants = [
    { id: 'first', section: '1', variantGroup: 'group' },
    { id: 'second', section: '1', variantGroup: 'group' },
    { id: 'independent', section: '1' },
  ];
  const tied = createQuizSession(variants, settings, 'normal', {}, () => false);
  assert.deepEqual(
    tied.pool.map(({ id }) => id),
    ['first', 'independent']
  );

  const random = createQuizSession(
    variants,
    settings,
    'random',
    { first: { seenCount: 2 }, second: { seenCount: 1 } },
    () => false
  );
  assert.equal(random.pool.length, 2);
  assert.equal(
    random.pool.some(({ id }) => id === 'second'),
    true
  );
  assert.equal(
    random.pool.some(({ id }) => id === 'first'),
    false
  );
  assert.equal(random.session.order.length, 2);
});

test('preserves selected and legacy same-group orders when restoring sessions', () => {
  const selected = createQuizSession(
    [
      { id: 'seen', section: '1', variantGroup: 'group' },
      { id: 'unseen', section: '1', variantGroup: 'group' },
    ],
    settings,
    'normal',
    { seen: { seenCount: 1 } },
    () => false
  ).session;
  assert.deepEqual(normalizeLoadedSession(JSON.parse(JSON.stringify(selected))).order, ['unseen']);

  const legacy = normalizeLoadedSession({
    schemaVersion: 1,
    order: ['seen', 'unseen'],
    currentIndex: 1,
    answers: { seen: 'A' },
    confidenceByQuestion: { unseen: 'low' },
    choiceMap: { seen: { A: 'B' } },
    graded: { seen: true },
  });
  assert.deepEqual(legacy.order, ['seen', 'unseen']);
  assert.equal(legacy.currentIndex, 1);
  assert.deepEqual(legacy.answers, { seen: 'A' });
  assert.deepEqual(legacy.confidenceByQuestion, { unseen: 'low' });
  assert.deepEqual(legacy.choiceMap, { seen: { A: 'B' } });
  assert.deepEqual(legacy.graded, { seen: true });
});
