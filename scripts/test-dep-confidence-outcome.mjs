import assert from 'node:assert/strict';

import {
  CONFIDENCE_OUTCOMES,
  deriveConfidenceOutcomeId,
  getConfidenceOutcome,
  getConfidenceOutcomeById,
} from '../dep-quiz-app/confidence-outcome.js';

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

test('reviewed Japanese copy remains fixed for the agreed outcomes', () => {
  const expectedCopy = {
    correct_high: [
      '理解が安定しています',
      '判断の根拠を持ち、自信が掴めている状態です',
      '必要に応じて解説を確認し、次の問題へ進みましょう',
    ],
    correct_medium: [
      '正解ですが、迷いが残っています',
      '確信が持てず、判断の根拠にまだ不安がある状態です',
      '迷った選択肢と正解の差異を深堀りましょう',
    ],
    correct_low: [
      '油断禁物。偶然の正解かもしれません',
      '正解ですが、再現性を持って回答できない可能性がある状態です。',
      '解説を読み、正解の根拠を自分の言葉で説明しましょう。',
    ],
    wrong_high: [
      '誤認です。前提から見直しましょう',
      '誤った前提や仕様の覚え違いが定着している可能性が高い状態です',
      '「なぜ、間違いか？」を重点的に確認してください',
    ],
    wrong_medium: [
      '理解が不安定です。問題意図と判断理由を振り返りましょう',
      '判断理由や選択肢の差異理解が不十分な可能性がある状態です',
      '解説と各選択肢の差異を重点的に確認してください',
    ],
    wrong_low: [
      '基礎から確認しましょう',
      '問題を解くための基礎概念や前提知識不足の可能性がある状態です。',
      '基礎概念と解説を順に見直しましょう',
    ],
  };

  for (const [id, copy] of Object.entries(expectedCopy)) {
    const outcome = getConfidenceOutcomeById(id);
    assert.deepEqual([outcome.title, outcome.meaning, outcome.action], copy);
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
