const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const WRONG_REASON_TAGS = Object.freeze([
  Object.freeze({ id: 'concept-understanding', label: '概念・仕様の理解不足' }),
  Object.freeze({ id: 'term-confusion', label: '用語・機能の混同' }),
  Object.freeze({ id: 'condition-overlook', label: '問題文・条件の読み落とし' }),
  Object.freeze({ id: 'choice-comparison', label: '選択肢の比較・消去不足' }),
  Object.freeze({ id: 'calculation-procedure', label: '計算・手順ミス' }),
  Object.freeze({ id: 'careless-time', label: 'ケアレスミス・時間不足' }),
]);

const WRONG_REASON_TAG_IDS = WRONG_REASON_TAGS.map((tag) => tag.id);
const WRONG_REASON_TAG_ID_SET = new Set(WRONG_REASON_TAG_IDS);

export function baseProgress() {
  return {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
    noteText: '',
    noteUpdatedAt: null,
    wrongReasonTags: [],
    wrongReasonUpdatedAt: null,
  };
}

export function normalizeWrongReasonTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];

  const accepted = new Set();
  rawTags.forEach((tag) => {
    if (typeof tag !== 'string') return;
    const normalizedTag = tag.trim();
    if (WRONG_REASON_TAG_ID_SET.has(normalizedTag)) {
      accepted.add(normalizedTag);
    }
  });

  return WRONG_REASON_TAG_IDS.filter((tagId) => accepted.has(tagId));
}

export function normalizeProgressEntry(entry) {
  if (!isPlainObject(entry)) return baseProgress();

  const wrongReasonTags = normalizeWrongReasonTags(entry.wrongReasonTags);

  return {
    seenCount: normalizeCount(entry.seenCount),
    correctCount: normalizeCount(entry.correctCount),
    wrongCount: normalizeCount(entry.wrongCount),
    lastAnsweredAt: normalizeIsoDate(entry.lastAnsweredAt),
    bookmark: typeof entry.bookmark === 'boolean' ? entry.bookmark : false,
    noteText: normalizeNoteText(entry),
    noteUpdatedAt: normalizeIsoDate(entry.noteUpdatedAt),
    wrongReasonTags,
    wrongReasonUpdatedAt:
      wrongReasonTags.length > 0 ? normalizeIsoDate(entry.wrongReasonUpdatedAt) : null,
  };
}

export function normalizeProgress(progress) {
  if (!isPlainObject(progress)) return {};

  return Object.fromEntries(
    Object.entries(progress)
      .map(([questionId, entry]) => [String(questionId).trim(), normalizeProgressEntry(entry)])
      .filter(([questionId]) => questionId.length > 0)
  );
}

export function getQuestionNote(progress, questionId) {
  const item = isPlainObject(progress) ? (progress[questionId] ?? {}) : {};
  return item.noteText ?? item.note ?? item.memo ?? '';
}

export function hasNote(progress, questionId) {
  return String(getQuestionNote(progress, questionId)).trim().length > 0;
}

export function saveNote(progress, questionId, rawNote) {
  const current = normalizeProgressEntry(progress?.[questionId]);
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
      ...normalizeProgressEntry(value),
      noteText: '',
      note: '',
      noteUpdatedAt: null,
    };
  });
  return next;
}

export function getQuestionWrongReasonTags(progress, questionId) {
  return normalizeProgressEntry(progress?.[questionId]).wrongReasonTags;
}

export function saveWrongReasonTags(progress, questionId, rawTags) {
  const current = normalizeProgressEntry(progress?.[questionId]);
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

function normalizeCount(value) {
  const number = Number(value ?? 0);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function normalizeNoteText(item) {
  const note = item.noteText ?? item.note ?? item.memo ?? '';
  return typeof note === 'string' ? note : '';
}

function normalizeIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
