import assert from 'node:assert/strict';

import {
  baseProgress,
  clearWrongReasonTags,
  getQuestionWrongReasonTags,
  normalizeProgressEntry,
  normalizeWrongReasonTags,
  saveWrongReasonTags,
  WRONG_REASON_TAGS,
} from '../dep-quiz-app/notes.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function assertIsoDate(value) {
  assert.equal(typeof value, 'string');
  assert.equal(Number.isNaN(Date.parse(value)), false);
}

test('baseProgress includes wrong reason tag defaults', () => {
  assert.deepEqual(baseProgress(), {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
    noteText: '',
    noteUpdatedAt: null,
    note: '',
    wrongReasonTags: [],
    wrongReasonUpdatedAt: null,
  });
});

test('WRONG_REASON_TAGS exposes seven stable IDs and labels', () => {
  assert.deepEqual(WRONG_REASON_TAGS, [
    { id: 'concept-behavior-gap', label: '概念・挙動がイメージできない' },
    { id: 'term-feature-meaning-confusion', label: '用語・機能の意味を混同した' },
    { id: 'spec-memory-error', label: '仕様の覚え違い' },
    { id: 'code-understanding-gap', label: '実装コードが理解できない' },
    { id: 'question-reading-overlook', label: '問題文の読み落とし' },
    { id: 'choice-difference-unclear', label: '選択肢の違いが分からず迷った' },
    { id: 'careless-mistake', label: 'ケアレスミス' },
  ]);
});

test('normalizeWrongReasonTags removes invalid values and orders by registry', () => {
  assert.deepEqual(
    normalizeWrongReasonTags([
      'careless-mistake',
      ' unknown ',
      '',
      ' term-feature-meaning-confusion ',
      'careless-mistake',
      123,
      null,
      'concept-behavior-gap',
    ]),
    ['concept-behavior-gap', 'term-feature-meaning-confusion', 'careless-mistake']
  );
  assert.deepEqual(
    normalizeWrongReasonTags([
      'concept-understanding',
      'term-confusion',
      'condition-overlook',
      'choice-comparison',
      'calculation-procedure',
      'careless-time',
    ]),
    []
  );
  assert.deepEqual(normalizeWrongReasonTags('careless-mistake'), []);
  assert.deepEqual(normalizeWrongReasonTags(null), []);
});

test('normalizeProgressEntry is backward compatible and sanitizes wrong reason fields', () => {
  assert.deepEqual(
    normalizeProgressEntry({
      seenCount: 2,
      correctCount: 1,
      wrongCount: 1,
      lastAnsweredAt: '2026-07-01T00:00:00.000Z',
      bookmark: true,
      noteText: 'memo',
      noteUpdatedAt: '2026-07-01T00:01:00.000Z',
      wrongReasonTags: [
        'choice-difference-unclear',
        'bad',
        'term-feature-meaning-confusion',
        'choice-difference-unclear',
      ],
      wrongReasonUpdatedAt: '2026-07-01T00:02:00.000Z',
    }),
    {
      seenCount: 2,
      correctCount: 1,
      wrongCount: 1,
      lastAnsweredAt: '2026-07-01T00:00:00.000Z',
      bookmark: true,
      noteText: 'memo',
      noteUpdatedAt: '2026-07-01T00:01:00.000Z',
      note: 'memo',
      wrongReasonTags: ['term-feature-meaning-confusion', 'choice-difference-unclear'],
      wrongReasonUpdatedAt: '2026-07-01T00:02:00.000Z',
    }
  );

  assert.deepEqual(
    normalizeProgressEntry({ wrongReasonTags: ['bad'], wrongReasonUpdatedAt: 'nope' }),
    {
      ...baseProgress(),
      wrongReasonTags: [],
      wrongReasonUpdatedAt: null,
    }
  );
});

test('normalizeProgressEntry keeps note and noteText aligned for current and legacy notes', () => {
  assert.deepEqual(normalizeProgressEntry({ noteText: 'current note' }).note, 'current note');
  assert.deepEqual(normalizeProgressEntry({ note: 'legacy note' }).noteText, 'legacy note');
  assert.deepEqual(normalizeProgressEntry({ note: 'legacy note' }).note, 'legacy note');
  assert.deepEqual(normalizeProgressEntry({ memo: 'legacy memo' }).noteText, 'legacy memo');
  assert.deepEqual(normalizeProgressEntry({ memo: 'legacy memo' }).note, 'legacy memo');
  assert.deepEqual(normalizeProgressEntry({ noteText: '' }).note, '');
});

test('getQuestionWrongReasonTags safely reads missing and malformed entries', () => {
  const progress = {
    Q001: { wrongReasonTags: ['careless-mistake', 'term-feature-meaning-confusion'] },
    Q002: { wrongReasonTags: 'careless-mistake' },
    Q003: { wrongReasonTags: ['unknown'] },
  };

  assert.deepEqual(getQuestionWrongReasonTags(progress, 'Q001'), [
    'term-feature-meaning-confusion',
    'careless-mistake',
  ]);
  assert.deepEqual(getQuestionWrongReasonTags(progress, 'Q002'), []);
  assert.deepEqual(getQuestionWrongReasonTags(progress, 'Q003'), []);
  assert.deepEqual(getQuestionWrongReasonTags(progress, 'Q999'), []);
});

test('saveWrongReasonTags preserves existing progress and does not mutate input', () => {
  const progress = {
    Q001: {
      seenCount: 5,
      correctCount: 3,
      wrongCount: 2,
      lastAnsweredAt: '2026-07-01T00:00:00.000Z',
      bookmark: true,
      noteText: 'memo',
      noteUpdatedAt: '2026-07-01T00:01:00.000Z',
    },
  };

  const saved = saveWrongReasonTags(progress, 'Q001', [
    'careless-mistake',
    'term-feature-meaning-confusion',
  ]);

  assert.notEqual(saved, progress);
  assert.equal(progress.Q001.wrongReasonTags, undefined);
  assert.deepEqual(saved.Q001.wrongReasonTags, [
    'term-feature-meaning-confusion',
    'careless-mistake',
  ]);
  assertIsoDate(saved.Q001.wrongReasonUpdatedAt);
  assert.equal(saved.Q001.seenCount, 5);
  assert.equal(saved.Q001.bookmark, true);
  assert.equal(saved.Q001.noteText, 'memo');
});

test('clearWrongReasonTags removes all tags and clears timestamp without mutating input', () => {
  const progress = {
    Q001: {
      ...baseProgress(),
      bookmark: true,
      wrongReasonTags: ['careless-mistake'],
      wrongReasonUpdatedAt: '2026-07-01T00:00:00.000Z',
    },
  };

  const cleared = clearWrongReasonTags(progress, 'Q001');

  assert.notEqual(cleared, progress);
  assert.deepEqual(progress.Q001.wrongReasonTags, ['careless-mistake']);
  assert.deepEqual(cleared.Q001.wrongReasonTags, []);
  assert.equal(cleared.Q001.wrongReasonUpdatedAt, null);
  assert.equal(cleared.Q001.bookmark, true);
});
