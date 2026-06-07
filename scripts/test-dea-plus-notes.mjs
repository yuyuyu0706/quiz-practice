import assert from 'node:assert/strict';

import {
  baseProgress,
  deleteNote,
  getQuestionNote,
  hasNote,
  normalizeProgress,
  normalizeProgressEntry,
  saveNote,
} from '../dea-quiz-app-plus/notes.js';
import { normalizeQuestionId } from '../dea-quiz-app-plus/question-id.js';
import { createQuizSession, normalizeLoadedSession } from '../dea-quiz-app-plus/quiz-session.js';
import {
  getRepairedStorageKeys,
  loadProgress,
  STORAGE_KEYS,
} from '../dea-quiz-app-plus/storage.js';

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
  assert.ok(value.length > 0);
  assert.equal(Number.isNaN(Date.parse(value)), false);
}

function installLocalStorageMock() {
  const store = new Map();

  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  return store;
}

test('baseProgress includes note fields with empty defaults', () => {
  assert.deepEqual(baseProgress(), {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
    noteText: '',
    noteUpdatedAt: null,
  });
});

test('normalizeProgressEntry coerces malformed progress values to safe defaults', () => {
  const normalized = normalizeProgressEntry({
    seenCount: '3',
    correctCount: -1,
    wrongCount: 'abc',
    lastAnsweredAt: 123,
    bookmark: 'yes',
    noteText: 123,
    noteUpdatedAt: 999,
    unexpectedField: 'drop-me',
  });

  assert.deepEqual(normalized, {
    seenCount: 3,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
    noteText: '',
    noteUpdatedAt: null,
  });
  assert.equal('unexpectedField' in normalized, false);
});

test('normalizeProgressEntry migrates legacy note and memo fields to noteText', () => {
  assert.equal(
    normalizeProgressEntry({ noteText: 'current', note: 'legacy note', memo: 'legacy memo' })
      .noteText,
    'current'
  );
  assert.equal(
    normalizeProgressEntry({ note: 'legacy note', memo: 'legacy memo' }).noteText,
    'legacy note'
  );
  assert.equal(normalizeProgressEntry({ memo: 'legacy memo' }).noteText, 'legacy memo');
  assert.equal(normalizeProgressEntry({ note: 123, memo: false }).noteText, '');
});

test('normalizeProgressEntry returns base progress for non object entries', () => {
  for (const entry of [null, undefined, [], 'abc', 123]) {
    assert.deepEqual(normalizeProgressEntry(entry), baseProgress());
  }
});

test('normalizeProgress normalizes each question entry and drops invalid question ids', () => {
  assert.deepEqual(normalizeProgress(null), {});
  assert.deepEqual(normalizeProgress([]), {});

  const normalized = normalizeProgress({
    Q001: { seenCount: '2', correctCount: '1', wrongCount: 1.5, note: 'legacy note' },
    '': { seenCount: 99, noteText: 'drop empty id' },
    '  ': { seenCount: 99, noteText: 'drop blank id' },
    Q002: null,
  });

  assert.deepEqual(normalized, {
    'DEA-PLUS-Q001': {
      seenCount: 2,
      correctCount: 1,
      wrongCount: 0,
      lastAnsweredAt: null,
      bookmark: false,
      noteText: 'legacy note',
      noteUpdatedAt: null,
    },
    'DEA-PLUS-Q002': baseProgress(),
  });
});

test('normalizeQuestionId maps legacy Q-number IDs to DEA Plus IDs', () => {
  assert.equal(normalizeQuestionId('Q1'), 'DEA-PLUS-Q001');
  assert.equal(normalizeQuestionId('Q10'), 'DEA-PLUS-Q010');
  assert.equal(normalizeQuestionId('Q100'), 'DEA-PLUS-Q100');
  assert.equal(normalizeQuestionId('DEA-PLUS-Q001'), 'DEA-PLUS-Q001');
});

test('normalizeProgress merges legacy and new ID entries without losing notes or bookmarks', () => {
  const normalized = normalizeProgress({
    Q1: {
      seenCount: 1,
      correctCount: 1,
      wrongCount: 0,
      bookmark: true,
      noteText: 'legacy memo',
      noteUpdatedAt: '2026-06-01T00:00:00.000Z',
    },
    'DEA-PLUS-Q001': {
      seenCount: 2,
      correctCount: 1,
      wrongCount: 1,
      bookmark: false,
      noteText: 'newer memo',
      noteUpdatedAt: '2026-06-02T00:00:00.000Z',
    },
  });

  assert.deepEqual(normalized, {
    'DEA-PLUS-Q001': {
      seenCount: 2,
      correctCount: 1,
      wrongCount: 1,
      lastAnsweredAt: null,
      bookmark: true,
      noteText: 'newer memo',
      noteUpdatedAt: '2026-06-02T00:00:00.000Z',
    },
  });
});

test('getQuestionNote reads noteText note and memo fallback fields', () => {
  const progress = {
    Q001: { noteText: 'current note', note: 'legacy note', memo: 'legacy memo' },
    Q002: { note: 'legacy note' },
    Q003: { memo: 'legacy memo' },
  };

  assert.equal(getQuestionNote(progress, 'Q001'), 'current note');
  assert.equal(getQuestionNote(progress, 'Q002'), 'legacy note');
  assert.equal(getQuestionNote(progress, 'Q003'), 'legacy memo');
  assert.equal(getQuestionNote(progress, 'Q999'), '');
  assert.equal(getQuestionNote(null, 'Q001'), '');
  assert.equal(getQuestionNote(undefined, 'Q001'), '');
});

test('hasNote treats empty and whitespace notes as missing', () => {
  const progress = {
    EMPTY: { noteText: '' },
    SPACES: { noteText: '   ' },
    CONTROL_WHITESPACE: { noteText: '\n\t ' },
    PRESENT: { noteText: '復習メモ' },
    LEGACY_NOTE_BLANK: { note: '   ' },
    LEGACY_NOTE_PRESENT: { note: ' 旧note ' },
    LEGACY_MEMO_BLANK: { memo: '\n\t ' },
    LEGACY_MEMO_PRESENT: { memo: ' 旧memo ' },
  };

  assert.equal(hasNote(progress, 'EMPTY'), false);
  assert.equal(hasNote(progress, 'SPACES'), false);
  assert.equal(hasNote(progress, 'CONTROL_WHITESPACE'), false);
  assert.equal(hasNote(progress, 'PRESENT'), true);
  assert.equal(hasNote(progress, 'LEGACY_NOTE_BLANK'), false);
  assert.equal(hasNote(progress, 'LEGACY_NOTE_PRESENT'), true);
  assert.equal(hasNote(progress, 'LEGACY_MEMO_BLANK'), false);
  assert.equal(hasNote(progress, 'LEGACY_MEMO_PRESENT'), true);
});

test('saveNote preserves progress counters and bookmark while storing trimmed note', () => {
  const progress = {
    Q001: {
      seenCount: 3,
      correctCount: 1,
      wrongCount: 2,
      lastAnsweredAt: '2026-06-01T00:00:00.000Z',
      bookmark: true,
    },
  };
  const originalProgress = structuredClone(progress);

  const updated = saveNote(progress, 'Q001', '  schema memo  ');

  assert.deepEqual(progress, originalProgress);
  assert.notEqual(updated, progress);
  assert.notEqual(updated.Q001, progress.Q001);
  assert.equal(updated.Q001.seenCount, 3);
  assert.equal(updated.Q001.correctCount, 1);
  assert.equal(updated.Q001.wrongCount, 2);
  assert.equal(updated.Q001.lastAnsweredAt, '2026-06-01T00:00:00.000Z');
  assert.equal(updated.Q001.bookmark, true);
  assert.equal(updated.Q001.noteText, 'schema memo');
  assertIsoDate(updated.Q001.noteUpdatedAt);
});

test('saveNote normalizes malformed entry while preserving valid progress values', () => {
  const updated = saveNote(
    {
      Q001: {
        seenCount: '2',
        correctCount: '1',
        wrongCount: -5,
        bookmark: true,
      },
    },
    'Q001',
    ' memo '
  );

  assert.equal(updated.Q001.seenCount, 2);
  assert.equal(updated.Q001.correctCount, 1);
  assert.equal(updated.Q001.wrongCount, 0);
  assert.equal(updated.Q001.bookmark, true);
  assert.equal(updated.Q001.noteText, 'memo');
  assertIsoDate(updated.Q001.noteUpdatedAt);
});

test('saveNote creates base progress entry for a new question', () => {
  const updated = saveNote({}, 'Q999', 'new memo');

  assert.equal(updated.Q999.seenCount, 0);
  assert.equal(updated.Q999.correctCount, 0);
  assert.equal(updated.Q999.wrongCount, 0);
  assert.equal(updated.Q999.lastAnsweredAt, null);
  assert.equal(updated.Q999.bookmark, false);
  assert.equal(updated.Q999.noteText, 'new memo');
  assertIsoDate(updated.Q999.noteUpdatedAt);
});

test('deleteNote clears note fields without removing progress data', () => {
  const progress = {
    Q001: {
      seenCount: 4,
      correctCount: 3,
      wrongCount: 1,
      lastAnsweredAt: '2026-06-02T00:00:00.000Z',
      bookmark: true,
      noteText: 'delete me',
      noteUpdatedAt: '2026-06-03T00:00:00.000Z',
    },
  };

  const updated = deleteNote(progress, 'Q001');

  assert.ok(updated.Q001);
  assert.equal(updated.Q001.noteText, '');
  assert.equal(updated.Q001.noteUpdatedAt, null);
  assert.equal(updated.Q001.seenCount, 4);
  assert.equal(updated.Q001.correctCount, 3);
  assert.equal(updated.Q001.wrongCount, 1);
  assert.equal(updated.Q001.lastAnsweredAt, '2026-06-02T00:00:00.000Z');
  assert.equal(updated.Q001.bookmark, true);
});

test('createQuizSession notesOnly includes only questions with trimmed noteText', () => {
  const questions = [
    { id: 'Q001', section: 'A', choices: { A: 'a' }, answer: 'A' },
    { id: 'Q002', section: 'A', choices: { A: 'a' }, answer: 'A' },
    { id: 'Q003', section: 'B', choices: { A: 'a' }, answer: 'A' },
    { id: 'Q004', section: 'A', choices: { A: 'a' }, answer: 'A' },
  ];
  const progress = {
    Q001: { noteText: 'memo' },
    Q002: { noteText: '   ' },
    Q003: { noteText: 'memo in section B' },
    Q004: { noteUpdatedAt: '2026-06-01T00:00:00.000Z' },
  };
  const settings = {
    sections: ['A'],
    count: 'all',
  };

  const { pool, session } = createQuizSession(questions, settings, 'notesOnly', progress);

  assert.deepEqual(
    pool.map((q) => q.id),
    ['Q001']
  );
  assert.equal(session.mode, 'notesOnly');
  assert.deepEqual(session.order, ['Q001']);
});

test('createQuizSession notesOnly respects selected count after filtering', () => {
  const questions = [
    { id: 'Q001', section: 'A', choices: { A: 'a' }, answer: 'A' },
    { id: 'Q002', section: 'A', choices: { A: 'a' }, answer: 'A' },
    { id: 'Q003', section: 'A', choices: { A: 'a' }, answer: 'A' },
    { id: 'Q004', section: 'A', choices: { A: 'a' }, answer: 'A' },
  ];
  const progress = {
    Q001: { noteText: 'memo 1' },
    Q002: { noteText: 'memo 2' },
    Q003: { noteText: 'memo 3' },
    Q004: { noteText: '' },
  };
  const settings = {
    sections: ['A'],
    count: '2',
  };

  const { pool, session } = createQuizSession(questions, settings, 'notesOnly', progress);

  assert.deepEqual(
    pool.map((q) => q.id),
    ['Q001', 'Q002', 'Q003']
  );
  assert.equal(pool.length, 3);
  assert.equal(session.order.length, 2);
  assert.deepEqual(session.order, ['Q001', 'Q002']);
});

test('normalizeLoadedSession rejects legacy or unknown question IDs after ID migration', () => {
  const validQuestionIds = new Set(['DEA-PLUS-Q001', 'DEA-PLUS-Q002']);

  assert.equal(
    normalizeLoadedSession({ order: ['Q1'], currentIndex: 0 }, { validQuestionIds }),
    null
  );
  assert.equal(
    normalizeLoadedSession({ order: ['DEA-PLUS-Q999'], currentIndex: 0 }, { validQuestionIds }),
    null
  );
  assert.deepEqual(
    normalizeLoadedSession({ order: ['DEA-PLUS-Q001'], currentIndex: 0 }, { validQuestionIds })
      .order,
    ['DEA-PLUS-Q001']
  );
});

test('loadProgress repairs malformed stored progress and records repair key', () => {
  const store = installLocalStorageMock();
  const malformedProgress = {
    Q001: {
      seenCount: '3',
      correctCount: -1,
      wrongCount: 'abc',
      bookmark: 'yes',
      note: 'legacy note',
      noteUpdatedAt: 999,
      unexpectedField: 'drop-me',
    },
  };
  store.set(STORAGE_KEYS.progress, JSON.stringify(malformedProgress));

  const loaded = loadProgress();

  const expected = {
    'DEA-PLUS-Q001': {
      seenCount: 3,
      correctCount: 0,
      wrongCount: 0,
      lastAnsweredAt: null,
      bookmark: false,
      noteText: 'legacy note',
      noteUpdatedAt: null,
    },
  };
  assert.deepEqual(loaded, expected);
  assert.deepEqual(JSON.parse(store.get(STORAGE_KEYS.progress)), expected);
  assert.ok(getRepairedStorageKeys().includes(STORAGE_KEYS.progress));

  delete globalThis.localStorage;
});
