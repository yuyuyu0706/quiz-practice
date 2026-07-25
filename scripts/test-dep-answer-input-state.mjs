import assert from 'node:assert/strict';
import { getAnswerInputState } from '../dep-quiz-app/answer-input-state.js';

const cases = [
  [{}, 'missing_both', false],
  [{ hasChoice: true }, 'missing_confidence', false],
  [{ confidence: 'high' }, 'missing_choice', false],
  [{ hasChoice: true, confidence: 'medium' }, 'ready', true],
  [{ hasChoice: true, confidence: 'low', graded: true }, 'graded', false],
  [{ hasChoice: true, confidence: 'invalid' }, 'missing_confidence', false],
];

for (const [input, id, canSubmit] of cases) {
  assert.deepEqual(getAnswerInputState(input), { id, canSubmit });
}

console.log('DEP answer input state tests passed.');
