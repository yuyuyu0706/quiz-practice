import { assertConfidenceLevel, normalizeConfidenceLevel } from './confidence.js';
import { normalizeWrongReasonTags } from './wrong-reason-tags.js';

export { normalizeWrongReasonTags } from './wrong-reason-tags.js';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
export const ANSWER_RESULT_IDS = Object.freeze(['correct', 'wrong']);
const ANSWER_RESULT_ID_SET = new Set(ANSWER_RESULT_IDS);

export function baseProgress() {
  return {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    lastConfidenceAnswer: null,
    bookmark: false,
    noteText: '',
    note: '',
    noteUpdatedAt: null,
    wrongReasonTags: [],
    wrongReasonUpdatedAt: null,
  };
}

export function normalizeLastConfidenceAnswer(value) {
  if (!isPlainObject(value) || !ANSWER_RESULT_ID_SET.has(value.result)) return null;
  const confidence = normalizeConfidenceLevel(value.confidence);
  const answeredAt = normalizeIsoDate(value.answeredAt);
  if (confidence === null || answeredAt === null) return null;
  return { result: value.result, confidence, answeredAt };
}

export function normalizeProgressEntry(entry) {
  if (!isPlainObject(entry)) return baseProgress();

  const noteText = normalizeNoteText(entry);
  const wrongReasonTags = normalizeWrongReasonTags(entry.wrongReasonTags);
  let lastAnsweredAt = normalizeIsoDate(entry.lastAnsweredAt);
  let lastConfidenceAnswer = normalizeLastConfidenceAnswer(entry.lastConfidenceAnswer);

  if (lastConfidenceAnswer !== null) {
    if (lastAnsweredAt === null) lastAnsweredAt = lastConfidenceAnswer.answeredAt;
    else if (lastAnsweredAt !== lastConfidenceAnswer.answeredAt) lastConfidenceAnswer = null;
  }

  return {
    ...entry,
    seenCount: normalizeCount(entry.seenCount),
    correctCount: normalizeCount(entry.correctCount),
    wrongCount: normalizeCount(entry.wrongCount),
    lastAnsweredAt,
    lastConfidenceAnswer,
    bookmark: typeof entry.bookmark === 'boolean' ? entry.bookmark : false,
    noteText,
    note: noteText,
    noteUpdatedAt: normalizeIsoDate(entry.noteUpdatedAt),
    wrongReasonTags,
    wrongReasonUpdatedAt:
      wrongReasonTags.length > 0 ? normalizeIsoDate(entry.wrongReasonUpdatedAt) : null,
  };
}

export function applyConfidenceAnswerResult(progress, questionId, answerResult) {
  if (typeof questionId !== 'string' || questionId.trim().length === 0) {
    throw new TypeError('Invalid question ID');
  }
  if (!isPlainObject(answerResult) || !ANSWER_RESULT_ID_SET.has(answerResult.result)) {
    throw new TypeError('Invalid answer result');
  }
  const confidence = assertConfidenceLevel(answerResult.confidence);
  const answeredAt = normalizeIsoDate(answerResult.answeredAt);
  if (answeredAt === null) throw new TypeError('Invalid answered date');

  const safeProgress = isPlainObject(progress) ? progress : {};
  const current = normalizeProgressEntry(safeProgress[questionId]);
  const result = answerResult.result;
  return {
    ...safeProgress,
    [questionId]: {
      ...current,
      seenCount: current.seenCount + 1,
      correctCount: current.correctCount + (result === 'correct' ? 1 : 0),
      wrongCount: current.wrongCount + (result === 'wrong' ? 1 : 0),
      lastAnsweredAt: answeredAt,
      lastConfidenceAnswer: { result, confidence, answeredAt },
    },
  };
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const normalizedValue = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return date.toISOString() === normalizedValue ? value : null;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
