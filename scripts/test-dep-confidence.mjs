import assert from 'node:assert/strict';

import {
  assertConfidenceLevel,
  CONFIDENCE_LEVELS,
  isConfidenceLevel,
  normalizeConfidenceLevel,
} from '../dep-quiz-app/confidence.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('CONFIDENCE_LEVELS exposes three immutable stable definitions in registry order', () => {
  assert.deepEqual(CONFIDENCE_LEVELS, [
    {
      id: 'high',
      label: '確信あり',
      description: '根拠を持って正しいと判断している',
    },
    {
      id: 'medium',
      label: '迷いあり',
      description: '候補は絞れたが、判断に迷いがある',
    },
    {
      id: 'low',
      label: '自信なし',
      description: '勘に近い、十分な根拠が持てない',
    },
  ]);
  assert.equal(Object.isFrozen(CONFIDENCE_LEVELS), true);
  CONFIDENCE_LEVELS.forEach((level) => assert.equal(Object.isFrozen(level), true));
  assert.equal(new Set(CONFIDENCE_LEVELS.map((level) => level.id)).size, 3);
});

test('isConfidenceLevel accepts only exact stable IDs', () => {
  ['high', 'medium', 'low'].forEach((value) => {
    assert.equal(isConfidenceLevel(value), true);
  });

  ['HIGH', 'Medium', ' high', 'high ', '', '確信あり', null, undefined, 1, true, [], {}].forEach(
    (value) => {
      assert.equal(isConfidenceLevel(value), false);
    }
  );
});

test('normalizeConfidenceLevel preserves valid IDs and safely rejects invalid values', () => {
  ['high', 'medium', 'low'].forEach((value) => {
    assert.equal(normalizeConfidenceLevel(value), value);
  });

  const input = { id: 'high' };
  ['HIGH', ' high ', '確信あり', null, undefined, 1, false, [], input].forEach((value) => {
    assert.doesNotThrow(() => normalizeConfidenceLevel(value));
    assert.equal(normalizeConfidenceLevel(value), null);
  });
  assert.deepEqual(input, { id: 'high' });
});

test('assertConfidenceLevel returns valid IDs and throws TypeError for invalid write values', () => {
  ['high', 'medium', 'low'].forEach((value) => {
    assert.equal(assertConfidenceLevel(value), value);
  });

  ['HIGH', ' high ', '確信あり', null, undefined, 1, false, [], {}].forEach((value) => {
    assert.throws(() => assertConfidenceLevel(value), TypeError);
  });
});
