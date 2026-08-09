import assert from 'node:assert/strict';
import { inspectVariantSelection } from '../tools/dep-question-authoring/variant-inspector.js';

const questions = [
  { id: 'A', section: '1', variantGroup: 'g' },
  { id: 'B', section: '1', variantGroup: 'g' },
];
const inspect = (overrides = {}) =>
  inspectVariantSelection({
    questions,
    groupId: 'g',
    settings: { sections: ['1'] },
    mode: 'normal',
    progress: {},
    ...overrides,
  });

let result = inspect({ progress: { A: { seenCount: 2 }, B: { seenCount: 1 } } });
assert.equal(result.winnerId, 'B');
assert.equal(result.members[0].reason, 'higher-seen-count');
assert.equal(result.members[1].reason, 'least-seen');

result = inspect({ progress: { A: { seenCount: 1 }, B: { seenCount: 1 } } });
assert.equal(result.winnerId, 'A');
assert.equal(result.members[0].reason, 'first-on-seen-count-tie');
assert.equal(result.members[1].reason, 'later-on-seen-count-tie');

for (const [mode, progress, reason] of [
  ['wrongOnly', { A: { wrongCount: 0 }, B: { wrongCount: 1 } }, 'wrong-only-ineligible'],
  ['bookmarks', { A: {}, B: { bookmark: true } }, 'bookmark-ineligible'],
  ['notesOnly', { A: { noteText: '   ' }, B: { noteText: 'memo' } }, 'notes-only-ineligible'],
]) {
  result = inspect({ mode, progress });
  assert.equal(result.winnerId, 'B');
  assert.equal(result.members[0].reason, reason);
  assert.equal(result.members[1].reason, 'only-eligible-member');
}

result = inspect({ settings: { sections: ['2'] } });
assert.equal(result.winnerId, null);
assert.equal(
  result.members.every((item) => item.reason === 'section-excluded'),
  true
);
result = inspect({ mode: 'random' });
assert.match(result.randomBoundary, /before session shuffle/);
console.log('dep variant inspector tests passed');
