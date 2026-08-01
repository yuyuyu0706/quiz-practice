import { CONFIDENCE_LEVELS } from './confidence.js';
import {
  CONFIDENCE_HISTORY_VERSION,
  MAX_CONFIDENCE_ATTEMPTS,
  normalizeConfidenceAttempt,
  normalizeConfidenceHistory,
} from './confidence-history.js';
import { CONFIDENCE_OUTCOMES, getConfidenceOutcome } from './confidence-outcome.js';
import { normalizeUtcIsoDate } from './utc-iso-date.js';

const PERIOD_DURATIONS = Object.freeze({
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
  all: null,
});

export function normalizeConfidenceHistoryQuery(query) {
  if (!isPlainObject(query) || !Object.hasOwn(PERIOD_DURATIONS, query.period)) {
    throw new TypeError('Invalid confidence history period');
  }
  if (
    !Object.hasOwn(query, 'sectionId') ||
    (query.sectionId !== null && !isIdentifier(query.sectionId))
  ) {
    throw new TypeError('Invalid confidence history section');
  }

  const asOf = normalizeUtcIsoDate(query.asOf);
  if (asOf === null) throw new TypeError('Invalid confidence history asOf');

  const duration = PERIOD_DURATIONS[query.period];
  return {
    period: query.period,
    sectionId: query.sectionId,
    asOf,
    from: duration === null ? null : new Date(Date.parse(asOf) - duration).toISOString(),
    to: asOf,
  };
}

export function selectConfidenceHistoryAttempts(history, query) {
  const canonicalQuery = normalizeConfidenceHistoryQuery(query);
  if (isPlainObject(history) && history.version > CONFIDENCE_HISTORY_VERSION) {
    throw new TypeError('Unsupported confidence history version');
  }

  const inputIsValid =
    isPlainObject(history) &&
    history.version === CONFIDENCE_HISTORY_VERSION &&
    Array.isArray(history.attempts);
  const rawAttempts = inputIsValid ? history.attempts : [];
  const quality = inspectQuality(rawAttempts);
  const canonicalHistory = normalizeConfidenceHistory(history);
  const toTime = Date.parse(canonicalQuery.to);
  const fromTime = canonicalQuery.from === null ? null : Date.parse(canonicalQuery.from);
  const attempts = [];
  const periodAttempts = [];
  let futureAttemptCount = 0;
  let excludedByPeriodCount = 0;
  let excludedBySectionCount = 0;

  for (const attempt of canonicalHistory.attempts) {
    const answeredTime = Date.parse(attempt.answeredAt);
    if (answeredTime > toTime) {
      futureAttemptCount += 1;
    } else if (fromTime !== null && answeredTime < fromTime) {
      excludedByPeriodCount += 1;
    } else {
      periodAttempts.push(attempt);
      if (canonicalQuery.sectionId !== null && attempt.section !== canonicalQuery.sectionId) {
        excludedBySectionCount += 1;
      } else {
        attempts.push({ ...attempt });
      }
    }
  }

  const normalizationExcludedCount =
    quality.invalidAttemptCount + quality.duplicateAttemptCount + quality.trimmedAttemptCount;
  const sourceAttemptCount = canonicalHistory.attempts.length;
  return {
    query: canonicalQuery,
    coverage: {
      sourceAttemptCount,
      filteredAttemptCount: attempts.length,
      uniqueQuestionCount: uniqueQuestionCount(attempts),
      futureAttemptCount,
      excludedByPeriodCount,
      excludedBySectionCount,
      status: attempts.length === 0 ? 'none' : 'available',
      qualityStatus:
        inputIsValid && normalizationExcludedCount === 0 ? 'clean' : 'invalid-data-excluded',
    },
    quality,
    retention: {
      maxAttemptCount: MAX_CONFIDENCE_ATTEMPTS,
      sourceAttemptCount,
      status: sourceAttemptCount === MAX_CONFIDENCE_ATTEMPTS ? 'capacity-reached' : 'within-limit',
    },
    sections: buildSections(periodAttempts),
    attempts,
  };
}

export function buildConfidenceHistorySummary(history, query) {
  const selection = selectConfidenceHistoryAttempts(history, query);
  const summary = countResults(selection.attempts);
  const confidenceLevels = CONFIDENCE_LEVELS.map(({ id, label }) => {
    const counts = countResults(selection.attempts.filter((attempt) => attempt.confidence === id));
    return { id, label, ...withoutUniqueCount(counts) };
  });
  const outcomes = CONFIDENCE_OUTCOMES.map((definition) => {
    const attemptCount = selection.attempts.reduce(
      (count, attempt) =>
        count +
        (getConfidenceOutcome(attempt.result, attempt.confidence)?.id === definition.id ? 1 : 0),
      0
    );
    return {
      id: definition.id,
      result: definition.result,
      confidence: definition.confidence,
      guidance: definition.guidance,
      title: definition.title,
      attemptCount,
      ratio: summary.attemptCount === 0 ? null : attemptCount / summary.attemptCount,
      ratioStatus: summary.attemptCount === 0 ? 'not-applicable' : 'available',
    };
  });
  const advanceAttemptCount = outcomes
    .filter((outcome) => outcome.guidance === 'advance')
    .reduce((total, outcome) => total + outcome.attemptCount, 0);
  const reviewAttemptCount = summary.attemptCount - advanceAttemptCount;

  return {
    ...selection,
    summary,
    confidenceLevels,
    outcomes,
    guidance: {
      advanceAttemptCount,
      reviewAttemptCount,
      advanceRatio: summary.attemptCount === 0 ? null : advanceAttemptCount / summary.attemptCount,
      reviewRatio: summary.attemptCount === 0 ? null : reviewAttemptCount / summary.attemptCount,
      ratioStatus: summary.attemptCount === 0 ? 'not-applicable' : 'available',
    },
  };
}

function inspectQuality(rawAttempts) {
  const seenAttemptIds = new Set();
  let invalidAttemptCount = 0;
  let duplicateAttemptCount = 0;
  let validUniqueCount = 0;
  for (const candidate of rawAttempts) {
    const attempt = normalizeConfidenceAttempt(candidate);
    if (attempt === null) {
      invalidAttemptCount += 1;
    } else if (seenAttemptIds.has(attempt.attemptId)) {
      duplicateAttemptCount += 1;
    } else {
      seenAttemptIds.add(attempt.attemptId);
      validUniqueCount += 1;
    }
  }
  return {
    invalidAttemptCount,
    duplicateAttemptCount,
    trimmedAttemptCount: Math.max(0, validUniqueCount - MAX_CONFIDENCE_ATTEMPTS),
  };
}

function countResults(attempts) {
  const correctCount = attempts.filter((attempt) => attempt.result === 'correct').length;
  const attemptCount = attempts.length;
  return {
    attemptCount,
    uniqueQuestionCount: uniqueQuestionCount(attempts),
    correctCount,
    wrongCount: attemptCount - correctCount,
    accuracyRate: attemptCount === 0 ? null : correctCount / attemptCount,
    accuracyRateStatus: attemptCount === 0 ? 'not-applicable' : 'available',
  };
}

function withoutUniqueCount({ uniqueQuestionCount: _uniqueQuestionCount, ...counts }) {
  return counts;
}

function uniqueQuestionCount(attempts) {
  return new Set(attempts.map((attempt) => attempt.questionId)).size;
}

function buildSections(attempts) {
  const sections = new Map();
  for (const attempt of attempts) {
    if (!sections.has(attempt.section)) {
      sections.set(attempt.section, {
        id: attempt.section,
        attemptCount: 0,
        questionIds: new Set(),
      });
    }
    const section = sections.get(attempt.section);
    section.attemptCount += 1;
    section.questionIds.add(attempt.questionId);
  }
  return [...sections.values()].map(({ id, attemptCount, questionIds }) => ({
    id,
    attemptCount,
    uniqueQuestionCount: questionIds.size,
  }));
}

function isIdentifier(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
