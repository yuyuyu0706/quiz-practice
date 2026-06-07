import assert from 'node:assert/strict';

import {
  baseProgress,
  deleteNote,
  getQuestionNote,
  hasNote,
  saveNote,
} from '../dea-quiz-app-plus/notes.js';
import { createQuizSession } from '../dea-quiz-app-plus/quiz-session.js';

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
