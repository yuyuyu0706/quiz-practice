import assert from 'node:assert/strict';

import {
  CONFIDENCE_OUTCOMES,
  deriveConfidenceOutcomeId,
  getConfidenceOutcome,
  getConfidenceOutcomeById,
} from '../dep-quiz-app/confidence-outcome.js';
import { renderConfidenceOutcome } from '../dep-quiz-app/render.js';

function createOutcomeElements() {
  const classes = new Set(['confidence-outcome', 'hidden']);

  return {
    confidenceOutcome: {
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
      },
    },
    confidenceOutcomeTitle: { textContent: '' },
    confidenceOutcomeMeaning: { textContent: '' },
    confidenceOutcomeAction: { textContent: '' },
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const expectedPairs = [
  ['correct', 'high', 'correct_high'],
  ['correct', 'medium', 'correct_medium'],
  ['correct', 'low', 'correct_low'],
  ['wrong', 'high', 'wrong_high'],
  ['wrong', 'medium', 'wrong_medium'],
  ['wrong', 'low', 'wrong_low'],
];

test('CONFIDENCE_OUTCOMES defines all six unique result and confidence combinations', () => {
  assert.equal(CONFIDENCE_OUTCOMES.length, 6);
  assert.equal(new Set(CONFIDENCE_OUTCOMES.map(({ id }) => id)).size, 6);
  assert.equal(
    new Set(CONFIDENCE_OUTCOMES.map(({ result, confidence }) => `${result}:${confidence}`)).size,
    6
  );

  for (const outcome of CONFIDENCE_OUTCOMES) {
    assert.deepEqual(Object.keys(outcome), [
      'id',
      'result',
      'confidence',
      'title',
      'meaning',
      'action',
    ]);
    for (const value of Object.values(outcome)) {
      assert.equal(typeof value, 'string');
      assert.notEqual(value.length, 0);
    }
  }
});

test('public APIs derive and retrieve the same definition for every valid combination', () => {
  for (const [result, confidence, id] of expectedPairs) {
    assert.equal(deriveConfidenceOutcomeId(result, confidence), id);
    assert.strictEqual(getConfidenceOutcome(result, confidence), getConfidenceOutcomeById(id));
  }
});

test('public APIs safely reject missing, invalid, and display-label values', () => {
  const invalidPairs = [
    [undefined, undefined],
    [null, null],
    ['', ''],
    ['Correct', 'high'],
    ['correct', 'HIGH'],
    ['正解', '確信あり'],
    [{ id: 'correct' }, { id: 'high' }],
  ];

  for (const args of invalidPairs) {
    assert.doesNotThrow(() => getConfidenceOutcome(...args));
    assert.equal(getConfidenceOutcome(...args), null);
    assert.equal(deriveConfidenceOutcomeId(...args), null);
  }

  for (const id of [
    undefined,
    null,
    '',
    'CORRECT_HIGH',
    'correct:high',
    '理解が安定しています',
    {},
  ]) {
    assert.doesNotThrow(() => getConfidenceOutcomeById(id));
    assert.equal(getConfidenceOutcomeById(id), null);
  }
});

test('registry, definitions, and returned outcomes are immutable', () => {
  assert.equal(Object.isFrozen(CONFIDENCE_OUTCOMES), true);
  for (const outcome of CONFIDENCE_OUTCOMES) {
    assert.equal(Object.isFrozen(outcome), true);
  }

  assert.throws(() => CONFIDENCE_OUTCOMES.push({}), TypeError);
  assert.throws(() => {
    getConfidenceOutcome('correct', 'high').title = 'changed';
  }, TypeError);
  assert.equal(getConfidenceOutcomeById('correct_high').title, '理解が安定しています');
});

test('lookups do not mutate caller values or existing progress data', () => {
  const result = new String('correct');
  const confidence = { id: 'high' };
  const progress = {
    Q1: {
      lastConfidenceAnswer: {
        result: 'wrong',
        confidence: 'medium',
        answeredAt: '2026-07-26T00:00:00.000Z',
      },
    },
  };
  const snapshot = structuredClone(progress);

  assert.equal(getConfidenceOutcome(result, confidence), null);
  assert.deepEqual(confidence, { id: 'high' });
  assert.equal(result.valueOf(), 'correct');
  assert.equal(
    getConfidenceOutcome(
      progress.Q1.lastConfidenceAnswer.result,
      progress.Q1.lastConfidenceAnswer.confidence
    ).id,
    'wrong_medium'
  );
  assert.deepEqual(progress, snapshot);
});

test('rendering shows the canonical title, meaning, and action after grading', () => {
  const els = createOutcomeElements();
  const outcome = getConfidenceOutcome('wrong', 'medium');

  renderConfidenceOutcome(els, outcome);

  assert.equal(els.confidenceOutcome.classList.contains('hidden'), false);
  assert.equal(els.confidenceOutcomeTitle.textContent, outcome.title);
  assert.equal(els.confidenceOutcomeMeaning.textContent, outcome.meaning);
  assert.equal(els.confidenceOutcomeAction.textContent, outcome.action);
});

test('rendering clears stale feedback when no outcome can be derived', () => {
  const els = createOutcomeElements();
  renderConfidenceOutcome(els, getConfidenceOutcome('correct', 'high'));

  renderConfidenceOutcome(els, getConfidenceOutcome('correct', 'invalid'));

  assert.equal(els.confidenceOutcome.classList.contains('hidden'), true);
  assert.equal(els.confidenceOutcomeTitle.textContent, '');
  assert.equal(els.confidenceOutcomeMeaning.textContent, '');
  assert.equal(els.confidenceOutcomeAction.textContent, '');
});
