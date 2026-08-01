import { CONFIDENCE_HISTORY_VERSION, normalizeConfidenceHistory } from './confidence-history.js';

export function buildConfidenceHistoryRepairPlan(value) {
  if (
    isPlainObject(value) &&
    Number.isInteger(value.version) &&
    value.version > CONFIDENCE_HISTORY_VERSION
  ) {
    return {
      status: 'unsupported',
      nextHistory: null,
      shouldWriteBack: false,
      unsupportedVersion: value.version,
      removedAttemptCount: 0,
    };
  }

  const nextHistory = normalizeConfidenceHistory(value);
  const canonical = isCanonicalHistory(value, nextHistory);
  const inputCount = Array.isArray(value?.attempts) ? value.attempts.length : 0;
  return {
    status: canonical ? 'ready' : 'repairable',
    nextHistory,
    shouldWriteBack: !canonical,
    unsupportedVersion: null,
    removedAttemptCount: Math.max(0, inputCount - nextHistory.attempts.length),
  };
}

function isCanonicalHistory(value, normalized) {
  if (!isPlainObject(value)) return false;
  if (!sameKeys(value, ['version', 'attempts']) || !Array.isArray(value.attempts)) return false;
  if (
    value.version !== normalized.version ||
    value.attempts.length !== normalized.attempts.length
  ) {
    return false;
  }
  return value.attempts.every((attempt, index) => {
    const canonical = normalized.attempts[index];
    return (
      isPlainObject(attempt) &&
      sameKeys(attempt, [
        'attemptId',
        'questionId',
        'section',
        'result',
        'confidence',
        'answeredAt',
      ]) &&
      Object.keys(canonical).every((key) => attempt[key] === canonical[key])
    );
  });
}

function sameKeys(value, expected) {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
