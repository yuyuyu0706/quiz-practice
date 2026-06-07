import { normalizeQuestionId } from './question-id.js';

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

  return Object.entries(progress)
    .filter(([questionId]) => typeof questionId === 'string' && questionId.trim())
    .reduce((normalized, [questionId, entry]) => {
      const normalizedQuestionId = normalizeQuestionId(questionId);
      const normalizedEntry = normalizeProgressEntry(entry);
      normalized[normalizedQuestionId] = mergeProgressEntries(
        normalized[normalizedQuestionId],
        normalizedEntry
      );
      return normalized;
    }, {});
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

function mergeProgressEntries(existingEntry, incomingEntry) {
  if (!existingEntry) return incomingEntry;

  const existing = normalizeProgressEntry(existingEntry);
  const incoming = normalizeProgressEntry(incomingEntry);
  const noteSource = chooseNoteSource(existing, incoming);

  return {
    seenCount: Math.max(existing.seenCount, incoming.seenCount),
    correctCount: Math.max(existing.correctCount, incoming.correctCount),
    wrongCount: Math.max(existing.wrongCount, incoming.wrongCount),
    lastAnsweredAt: maxIsoString(existing.lastAnsweredAt, incoming.lastAnsweredAt),
    bookmark: existing.bookmark || incoming.bookmark,
    noteText: noteSource.noteText,
    noteUpdatedAt: noteSource.noteUpdatedAt,
  };
}

function chooseNoteSource(existing, incoming) {
  const existingHasNote = String(existing.noteText ?? '').trim().length > 0;
  const incomingHasNote = String(incoming.noteText ?? '').trim().length > 0;

  if (existingHasNote && incomingHasNote) {
    return isAfter(incoming.noteUpdatedAt, existing.noteUpdatedAt) ? incoming : existing;
  }

  if (incomingHasNote) return incoming;
  if (existingHasNote) return existing;

  return isAfter(incoming.noteUpdatedAt, existing.noteUpdatedAt) ? incoming : existing;
}

function maxIsoString(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return isAfter(b, a) ? b : a;
}

function isAfter(candidate, current) {
  if (!candidate) return false;
  if (!current) return true;
  return candidate > current;
}
