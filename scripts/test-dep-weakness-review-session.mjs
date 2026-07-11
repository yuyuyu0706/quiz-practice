import assert from 'node:assert/strict';

import { normalizeLoadedSession } from '../dep-quiz-app/quiz-session.js';
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

function targetItem(id, overrides = {}) {
  return {
    id,
    section: '1',
    questionText: `Question ${id}`,
    ...overrides,
  };
}

function targetPlan(overrides = {}) {
  return {
    condition: {
      type: 'section',
      value: '2',
      label: 'Section 2：Container Queries',
    },
    targetCount: 3,
    items: [targetItem('DEP-Q3'), targetItem('DEP-Q1'), targetItem('DEP-Q2')],
    emptyState: null,
    unavailableProgressIds: [],
    ...overrides,
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('creates a weakness review session from a section target plan', () => {
  const plan = targetPlan();

  const session = createWeaknessReviewSession(plan);

  assert.equal(session.schemaVersion, 1);
  assert.equal(session.app, 'dep-quiz-app');
  assert.equal(session.mode, 'weaknessReview');
  assert.deepEqual(session.order, ['DEP-Q3', 'DEP-Q1', 'DEP-Q2']);
  assert.equal(session.currentIndex, 0);
  assert.deepEqual(session.answers, {});
  assert.deepEqual(session.choiceMap, {});
  assert.deepEqual(session.graded, {});
  assert.equal(session.completedAt, null);
  assert.equal(session.explanationOpen, false);
  assert.equal(typeof session.startedAt, 'string');
  assert.deepEqual(session.settingsSnapshot, {
    mode: 'weaknessReview',
    count: 3,
    source: 'weaknessReviewTargets',
    condition: {
      type: 'section',
      value: '2',
      label: 'Section 2：Container Queries',
    },
  });
});

test('creates a weakness review session from a wrong-reason-tag target plan', () => {
  const plan = targetPlan({
    condition: {
      type: 'wrongReasonTag',
      value: 'concept-gap',
      label: '概念理解が曖昧',
    },
    targetCount: 1,
    items: [targetItem('DEP-Q9')],
  });

  const session = createWeaknessReviewSession(plan);

  assert.deepEqual(session.order, ['DEP-Q9']);
  assert.equal(session.mode, 'weaknessReview');
  assert.deepEqual(session.settingsSnapshot.condition, {
    type: 'wrongReasonTag',
    value: 'concept-gap',
    label: '概念理解が曖昧',
  });
  assert.equal(session.settingsSnapshot.count, 1);
});

test('preserves targetPlan.items order exactly without re-sorting or deduping', () => {
  const plan = targetPlan({
    items: [targetItem('Z-10'), targetItem('A-01'), targetItem('M-05')],
  });

  const session = createWeaknessReviewSession(plan);

  assert.deepEqual(session.order, ['Z-10', 'A-01', 'M-05']);
});

test('normalizes as an existing quiz session while preserving weakness review snapshot', () => {
  const session = createWeaknessReviewSession(targetPlan());

  const normalized = normalizeLoadedSession(JSON.parse(JSON.stringify(session)));

  assert.deepEqual(normalized, session);
  assert.equal(normalized.mode, 'weaknessReview');
  assert.deepEqual(normalized.settingsSnapshot.condition, session.settingsSnapshot.condition);
});

test('does not mutate targetPlan, items, or condition', () => {
  const plan = targetPlan();
  const original = deepClone(plan);

  createWeaknessReviewSession(plan);

  assert.deepEqual(plan, original);
});

test('does not share mutable references from output session back to targetPlan', () => {
  const plan = targetPlan();
  const session = createWeaknessReviewSession(plan);

  session.order.push('NEW-ID');
  session.settingsSnapshot.condition.value = 'changed';
  session.settingsSnapshot.condition.label = 'Changed label';

  assert.deepEqual(
    plan.items.map((item) => item.id),
    ['DEP-Q3', 'DEP-Q1', 'DEP-Q2']
  );
  assert.deepEqual(plan.condition, {
    type: 'section',
    value: '2',
    label: 'Section 2：Container Queries',
  });
});

test('rejects null, undefined, and invalid targetPlan structure', () => {
  assert.throws(() => createWeaknessReviewSession(null), TypeError);
  assert.throws(() => createWeaknessReviewSession(undefined), TypeError);
  assert.throws(() => createWeaknessReviewSession([]), TypeError);
  assert.throws(() => createWeaknessReviewSession({ condition: {} }), TypeError);
  assert.throws(() => createWeaknessReviewSession({ items: [], condition: null }), TypeError);
});

test('rejects empty target items', () => {
  assert.throws(() => createWeaknessReviewSession(targetPlan({ items: [] })), RangeError);
});

test('rejects invalid target item ids', () => {
  assert.throws(
    () => createWeaknessReviewSession(targetPlan({ items: [targetItem('')] })),
    TypeError
  );
  assert.throws(
    () => createWeaknessReviewSession(targetPlan({ items: [targetItem('   ')] })),
    TypeError
  );
  assert.throws(() => createWeaknessReviewSession(targetPlan({ items: [{ id: 123 }] })), TypeError);
  assert.throws(() => createWeaknessReviewSession(targetPlan({ items: [null] })), TypeError);
});

test('rejects duplicate target item ids', () => {
  assert.throws(
    () =>
      createWeaknessReviewSession(targetPlan({ items: [targetItem('DUP'), targetItem('DUP')] })),
    TypeError
  );
});
