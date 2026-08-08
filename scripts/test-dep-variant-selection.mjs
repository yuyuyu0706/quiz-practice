import assert from 'node:assert/strict';

import { selectVariantCandidates } from '../dep-quiz-app/variant-selection.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const question = (id, variantGroup, extra = {}) => ({
  id,
  prompt: `Question ${id}`,
  ...(variantGroup === undefined ? {} : { variantGroup }),
  ...extra,
});
const ids = (questions) => questions.map(({ id }) => id);

test('returns an empty array for an empty eligible set', () => {
  assert.deepEqual(selectVariantCandidates([], {}), []);
});

test('preserves ungrouped candidates and a single-member group in order', () => {
  const input = [question('A'), question('B', 'g1'), question('C')];
  assert.deepEqual(ids(selectVariantCandidates(input, {})), ['A', 'B', 'C']);
});

test('collapses a group to its least-seen member', () => {
  const input = [question('A', 'g1'), question('B', 'g1')];
  assert.deepEqual(
    ids(selectVariantCandidates(input, { A: { seenCount: 5 }, B: { seenCount: 1 } })),
    ['B']
  );
  assert.deepEqual(
    ids(selectVariantCandidates(input, { A: { seenCount: 1 }, B: { seenCount: 0 } })),
    ['B']
  );
});

test('normalizes missing, legacy string, negative, fractional, and invalid counts via progress', () => {
  const input = [
    question('missing', 'g1'),
    question('seen', 'g1'),
    question('legacy', 'g2'),
    question('larger', 'g2'),
    question('negative', 'g3'),
    question('valid', 'g3'),
    question('fractional', 'g4'),
    question('invalid', 'g4'),
  ];
  const progress = {
    seen: { seenCount: 1 },
    legacy: { seenCount: '2' },
    larger: { seenCount: 3 },
    negative: { seenCount: -1 },
    valid: { seenCount: 1 },
    fractional: { seenCount: 0.5 },
    invalid: { seenCount: 'not-a-number' },
  };
  assert.deepEqual(ids(selectVariantCandidates(input, progress)), [
    'missing',
    'legacy',
    'negative',
    'fractional',
  ]);
});

test('uses stable input order for two-way and longer seen-count ties', () => {
  const input = [question('A', 'g1'), question('B', 'g1'), question('C', 'g1')];
  const progress = { A: { seenCount: 2 }, B: { seenCount: 2 }, C: { seenCount: 2 } };
  assert.deepEqual(ids(selectVariantCandidates(input, progress)), ['A']);
});

test('keeps the first group slot and ungrouped relative order when a later member wins', () => {
  const input = [question('A', 'g1'), question('X'), question('B', 'g1'), question('Y')];
  const progress = { A: { seenCount: 3 }, B: { seenCount: 1 } };
  assert.deepEqual(ids(selectVariantCandidates(input, progress)), ['B', 'X', 'Y']);
});

test('collapses multiple exact, case-sensitive group identities independently', () => {
  const input = [
    question('A1', 'alpha'),
    question('B1', 'beta'),
    question('A2', 'alpha'),
    question('upper', 'ALPHA'),
    question('B2', 'beta'),
  ];
  const progress = {
    A1: { seenCount: 4 },
    A2: { seenCount: 1 },
    B1: { seenCount: 0 },
    B2: { seenCount: 2 },
  };
  assert.deepEqual(ids(selectVariantCandidates(input, progress)), ['A2', 'B1', 'upper']);
});

test('does not use followUp when choosing a representative', () => {
  const input = [
    question('with-follow-up', 'g1', { followUp: { prompt: 'More?' } }),
    question('without-follow-up', 'g1'),
  ];
  assert.deepEqual(ids(selectVariantCandidates(input, {})), ['with-follow-up']);
});

test('does not mutate the array, questions, or progress and is deterministic', () => {
  const input = [question('A', 'g1'), question('X'), question('B', 'g1')];
  const progress = { A: { seenCount: '4', legacy: true }, B: { seenCount: 1 } };
  const arraySnapshot = [...input];
  const questionSnapshot = structuredClone(input);
  const progressSnapshot = structuredClone(progress);

  const first = selectVariantCandidates(input, progress);
  const second = selectVariantCandidates(input, progress);

  assert.notEqual(first, input);
  assert.deepEqual(input, arraySnapshot);
  assert.deepEqual(input, questionSnapshot);
  assert.deepEqual(progress, progressSnapshot);
  assert.deepEqual(ids(first), ids(second));
  assert.equal(first[0], input[2]);
});
