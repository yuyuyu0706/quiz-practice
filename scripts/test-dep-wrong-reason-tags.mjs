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
    wrongReasonTags: [],
    wrongReasonUpdatedAt: null,
  });
});

test('WRONG_REASON_TAGS exposes six stable IDs and labels', () => {
  assert.deepEqual(WRONG_REASON_TAGS, [
    { id: 'concept-understanding', label: '概念・仕様の理解不足' },
    { id: 'term-confusion', label: '用語・機能の混同' },
    { id: 'condition-overlook', label: '問題文・条件の読み落とし' },
    { id: 'choice-comparison', label: '選択肢の比較・消去不足' },
    { id: 'calculation-procedure', label: '計算・手順ミス' },
    { id: 'careless-time', label: 'ケアレスミス・時間不足' },
  ]);
});

test('normalizeWrongReasonTags removes invalid values and orders by registry', () => {
  assert.deepEqual(
    normalizeWrongReasonTags([
      'careless-time',
      ' unknown ',
      '',
      ' term-confusion ',
      'careless-time',
      123,
      null,
      'concept-understanding',
    ]),
    ['concept-understanding', 'term-confusion', 'careless-time']
  );
  assert.deepEqual(normalizeWrongReasonTags('careless-time'), []);
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
      wrongReasonTags: ['choice-comparison', 'bad', 'term-confusion', 'choice-comparison'],
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
      wrongReasonTags: ['term-confusion', 'choice-comparison'],
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

test('getQuestionWrongReasonTags safely reads missing and malformed entries', () => {
  const progress = {
    Q001: { wrongReasonTags: ['careless-time', 'term-confusion'] },
    Q002: { wrongReasonTags: 'careless-time' },
    Q003: { wrongReasonTags: ['unknown'] },
  };

  assert.deepEqual(getQuestionWrongReasonTags(progress, 'Q001'), [
    'term-confusion',
    'careless-time',
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

  const saved = saveWrongReasonTags(progress, 'Q001', ['careless-time', 'term-confusion']);

  assert.notEqual(saved, progress);
  assert.equal(progress.Q001.wrongReasonTags, undefined);
  assert.deepEqual(saved.Q001.wrongReasonTags, ['term-confusion', 'careless-time']);
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
      wrongReasonTags: ['careless-time'],
      wrongReasonUpdatedAt: '2026-07-01T00:00:00.000Z',
    },
  };

  const cleared = clearWrongReasonTags(progress, 'Q001');

  assert.notEqual(cleared, progress);
  assert.deepEqual(progress.Q001.wrongReasonTags, ['careless-time']);
  assert.deepEqual(cleared.Q001.wrongReasonTags, []);
  assert.equal(cleared.Q001.wrongReasonUpdatedAt, null);
  assert.equal(cleared.Q001.bookmark, true);
});
