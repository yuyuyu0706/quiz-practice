import { normalizeConfidenceLevel } from './confidence.js';
import { ANSWER_RESULT_IDS } from './progress.js';
import { normalizeUtcIsoDate } from './utc-iso-date.js';

export const CONFIDENCE_HISTORY_VERSION = 1;
export const MAX_CONFIDENCE_ATTEMPTS = 5000;

const ANSWER_RESULT_ID_SET = new Set(ANSWER_RESULT_IDS);

export function createEmptyConfidenceHistory() {
  return { version: CONFIDENCE_HISTORY_VERSION, attempts: [] };
}

export function createConfidenceAttempt(input) {
  const attempt = normalizeConfidenceAttempt(input);
  if (attempt === null) throw new TypeError('Invalid confidence attempt');
  return attempt;
}

export function normalizeConfidenceAttempt(value) {
  if (!isPlainObject(value)) return null;

  const attemptId = normalizeIdentifier(value.attemptId);
  const questionId = normalizeIdentifier(value.questionId);
  const section = normalizeIdentifier(value.section);
  const result = ANSWER_RESULT_ID_SET.has(value.result) ? value.result : null;
  const confidence = normalizeConfidenceLevel(value.confidence);
  const answeredAt = normalizeUtcIsoDate(value.answeredAt);

  if (
    attemptId === null ||
    questionId === null ||
    section === null ||
    result === null ||
    confidence === null ||
    answeredAt === null
  ) {
    return null;
  }

  return { attemptId, questionId, section, result, confidence, answeredAt };
}

export function normalizeConfidenceHistory(value) {
  if (
    !isPlainObject(value) ||
    value.version !== CONFIDENCE_HISTORY_VERSION ||
    !Array.isArray(value.attempts)
  ) {
    return createEmptyConfidenceHistory();
  }

  const seenAttemptIds = new Set();
  const attempts = [];

  value.attempts.forEach((candidate, index) => {
    const attempt = normalizeConfidenceAttempt(candidate);
    if (attempt === null || seenAttemptIds.has(attempt.attemptId)) return;

    seenAttemptIds.add(attempt.attemptId);
    attempts.push({ attempt, index });
  });

  attempts.sort(
    (left, right) =>
      Date.parse(left.attempt.answeredAt) - Date.parse(right.attempt.answeredAt) ||
      left.index - right.index
  );

  return {
    version: CONFIDENCE_HISTORY_VERSION,
    attempts: attempts.slice(-MAX_CONFIDENCE_ATTEMPTS).map(({ attempt }) => ({ ...attempt })),
  };
}

export function appendConfidenceAttempt(history, attempt) {
  const normalizedHistory = normalizeConfidenceHistory(history);
  const inputAttemptCount = Array.isArray(history?.attempts) ? history.attempts.length : 0;
  const normalizationTrimmedCount = Math.max(
    0,
    inputAttemptCount - normalizedHistory.attempts.length
  );
  const canonicalAttempt = createConfidenceAttempt(attempt);
  const duplicate = normalizedHistory.attempts.some(
    (existingAttempt) => existingAttempt.attemptId === canonicalAttempt.attemptId
  );

  if (duplicate) {
    return {
      nextHistory: normalizeConfidenceHistory(normalizedHistory),
      added: false,
      duplicate: true,
      trimmedCount: normalizationTrimmedCount,
    };
  }

  const candidateCount = normalizedHistory.attempts.length + 1;
  const nextHistory = normalizeConfidenceHistory({
    version: CONFIDENCE_HISTORY_VERSION,
    attempts: [...normalizedHistory.attempts, canonicalAttempt],
  });

  return {
    nextHistory,
    added: true,
    duplicate: false,
    trimmedCount:
      normalizationTrimmedCount + Math.max(0, candidateCount - nextHistory.attempts.length),
  };
}

function normalizeIdentifier(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value ? value : null;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
