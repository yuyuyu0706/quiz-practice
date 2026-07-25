import { baseProgress, normalizeProgressEntry } from './progress.js';
import { normalizeWrongReasonTags } from './wrong-reason-tags.js';

export { baseProgress, normalizeProgressEntry } from './progress.js';
export { WRONG_REASON_TAGS, normalizeWrongReasonTags } from './wrong-reason-tags.js';

export function getQuestionNote(progress, questionId) {
  const item = isPlainObject(progress) ? (progress[questionId] ?? {}) : {};
  return item.noteText ?? item.note ?? item.memo ?? '';
}

export function hasNote(progress, questionId) {
  return String(getQuestionNote(progress, questionId)).trim().length > 0;
}

export function saveNote(progress, questionId, rawNote) {
  const current = {
    ...baseProgress(),
    ...(isPlainObject(progress?.[questionId]) ? progress[questionId] : {}),
  };
  const noteText = String(rawNote ?? '').trim();
  current.noteText = noteText;
  current.note = noteText;
  current.noteUpdatedAt = noteText ? new Date().toISOString() : null;
  return { ...(isPlainObject(progress) ? progress : {}), [questionId]: current };
}

export function deleteNote(progress, questionId) {
  return saveNote(progress, questionId, '');
}

export function deleteAllNotes(progress) {
  const next = { ...(isPlainObject(progress) ? progress : {}) };
  Object.entries(next).forEach(([key, value]) => {
    next[key] = {
      ...baseProgress(),
      ...(isPlainObject(value) ? value : {}),
      noteText: '',
      note: '',
      noteUpdatedAt: null,
    };
  });
  return next;
}

export function getQuestionWrongReasonTags(progress, questionId) {
  return normalizeWrongReasonTags(progress?.[questionId]?.wrongReasonTags);
}

export function saveWrongReasonTags(progress, questionId, rawTags) {
  const current = {
    ...baseProgress(),
    ...(isPlainObject(progress?.[questionId]) ? progress[questionId] : {}),
  };
  const wrongReasonTags = normalizeWrongReasonTags(rawTags);
  current.wrongReasonTags = wrongReasonTags;
  current.wrongReasonUpdatedAt = wrongReasonTags.length > 0 ? new Date().toISOString() : null;
  return { ...(isPlainObject(progress) ? progress : {}), [questionId]: current };
}

export function clearWrongReasonTags(progress, questionId) {
  return saveWrongReasonTags(progress, questionId, []);
}

export function getAllNoteItems(questions, progress) {
  return questions
    .map((question) => {
      const item = progress[question.id] ?? {};
      const noteText = String(item.noteText ?? item.note ?? '').trim();
      if (!noteText) return null;
      return {
        id: question.id,
        section: question.section,
        questionText: question.question,
        noteText,
        noteUpdatedAt: item.noteUpdatedAt ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.noteUpdatedAt ?? 0) - new Date(a.noteUpdatedAt ?? 0));
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
