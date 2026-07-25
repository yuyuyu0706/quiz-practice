import { baseProgress, normalizeProgressEntry, normalizeWrongReasonTags } from './progress.js';

export { baseProgress, normalizeProgressEntry, normalizeWrongReasonTags } from './progress.js';

export const WRONG_REASON_TAGS = Object.freeze([
  Object.freeze({ id: 'concept-behavior-gap', label: '概念・挙動がイメージできない' }),
  Object.freeze({ id: 'term-feature-meaning-confusion', label: '用語・機能の意味を混同した' }),
  Object.freeze({ id: 'spec-memory-error', label: '仕様の覚え違い' }),
  Object.freeze({ id: 'code-understanding-gap', label: '実装コードが理解できない' }),
  Object.freeze({ id: 'question-reading-overlook', label: '問題文の読み落とし' }),
  Object.freeze({ id: 'choice-difference-unclear', label: '選択肢の違いが分からず迷った' }),
  Object.freeze({ id: 'careless-mistake', label: 'ケアレスミス' }),
]);

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
