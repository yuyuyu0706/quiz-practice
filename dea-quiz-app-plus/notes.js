// 問題単位の学習進捗と自分用メモの初期値・更新補助を提供する。
export function baseProgress() {
  return {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
    noteText: '',
    noteUpdatedAt: null,
  };
}

export function normalizeProgressEntry(entry) {
  if (!isPlainObject(entry)) {
    return baseProgress();
  }

  return {
    seenCount: normalizeCount(entry.seenCount),
    correctCount: normalizeCount(entry.correctCount),
    wrongCount: normalizeCount(entry.wrongCount),
    lastAnsweredAt: typeof entry.lastAnsweredAt === 'string' ? entry.lastAnsweredAt : null,
    bookmark: typeof entry.bookmark === 'boolean' ? entry.bookmark : false,
    noteText: normalizeNoteText(entry),
    noteUpdatedAt: typeof entry.noteUpdatedAt === 'string' ? entry.noteUpdatedAt : null,
  };
}

export function normalizeProgress(progress) {
  if (!isPlainObject(progress)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(progress)
      .filter(([questionId]) => typeof questionId === 'string' && questionId.trim())
      .map(([questionId, entry]) => [questionId, normalizeProgressEntry(entry)])
  );
}

export function getQuestionNote(progress, questionId) {
  const item = progress?.[questionId] ?? {};
  return item.noteText ?? item.note ?? item.memo ?? '';
}

export function hasNote(progress, questionId) {
  return String(getQuestionNote(progress, questionId)).trim().length > 0;
}

export function saveNote(progress, questionId, rawNote) {
  const current = normalizeProgressEntry(progress?.[questionId]);
  const noteText = String(rawNote ?? '').trim();

  current.noteText = noteText;
  current.noteUpdatedAt = noteText ? new Date().toISOString() : null;

  return { ...(progress ?? {}), [questionId]: current };
}

export function deleteNote(progress, questionId) {
  return saveNote(progress, questionId, '');
}

function normalizeCount(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }

  return 0;
}

function normalizeNoteText(entry) {
  if (typeof entry.noteText === 'string') return entry.noteText;
  if (typeof entry.note === 'string') return entry.note;
  if (typeof entry.memo === 'string') return entry.memo;
  return '';
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
