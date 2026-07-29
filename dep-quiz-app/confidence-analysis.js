import { CONFIDENCE_LEVELS } from './confidence.js';
import { CONFIDENCE_OUTCOMES, getConfidenceOutcome } from './confidence-outcome.js';
import { normalizeProgressEntry } from './progress.js';

const HIGHLIGHTED_OUTCOMES = Object.freeze([
  Object.freeze({ outcomeId: 'wrong_high', reasonCode: 'misconception-risk' }),
  Object.freeze({ outcomeId: 'correct_low', reasonCode: 'unstable-correctness' }),
]);

export function buildConfidenceAnalysis(questions, progress) {
  const safeProgress = isPlainObject(progress) ? progress : {};
  const validQuestionIds = collectValidQuestionIds(questions);
  const classifiedItems = [];
  let invalidLatestAnswerCount = 0;

  for (const questionId of validQuestionIds) {
    const rawEntry = safeProgress[questionId];
    const rawLatestAnswer = isPlainObject(rawEntry) ? rawEntry.lastConfidenceAnswer : null;
    const normalizedLatestAnswer = normalizeProgressEntry(rawEntry).lastConfidenceAnswer;

    if (normalizedLatestAnswer === null) {
      if (rawLatestAnswer !== null && rawLatestAnswer !== undefined) invalidLatestAnswerCount += 1;
      continue;
    }

    const outcome = getConfidenceOutcome(
      normalizedLatestAnswer.result,
      normalizedLatestAnswer.confidence
    );
    if (outcome === null) {
      invalidLatestAnswerCount += 1;
      continue;
    }

    classifiedItems.push({
      questionId,
      result: normalizedLatestAnswer.result,
      confidence: normalizedLatestAnswer.confidence,
      outcomeId: outcome.id,
      guidance: outcome.guidance,
      answeredAt: normalizedLatestAnswer.answeredAt,
    });
  }

  const totalQuestionCount = validQuestionIds.length;
  const classifiedQuestionCount = classifiedItems.length;
  const unclassifiedQuestionCount = totalQuestionCount - classifiedQuestionCount;
  const confidenceLevels = CONFIDENCE_LEVELS.map(({ id, label }) => {
    const items = classifiedItems.filter((item) => item.confidence === id);
    const correctCount = items.filter((item) => item.result === 'correct').length;
    const questionCount = items.length;
    return {
      id,
      label,
      questionCount,
      correctCount,
      wrongCount: questionCount - correctCount,
      accuracyRate: questionCount === 0 ? null : correctCount / questionCount,
      accuracyRateStatus: questionCount === 0 ? 'not-applicable' : 'available',
    };
  });
  const outcomes = CONFIDENCE_OUTCOMES.map(({ id, result, confidence, guidance, title }) => ({
    id,
    result,
    confidence,
    guidance,
    title,
    questionCount: classifiedItems.filter((item) => item.outcomeId === id).length,
  }));
  const outcomeCountById = new Map(outcomes.map(({ id, questionCount }) => [id, questionCount]));
  const highlightedOutcomes = HIGHLIGHTED_OUTCOMES.map(({ outcomeId, reasonCode }) => ({
    outcomeId,
    questionCount: outcomeCountById.get(outcomeId) ?? 0,
    reasonCode,
  }));
  const advanceQuestionCount = classifiedItems.filter((item) => item.guidance === 'advance').length;

  return {
    coverage: {
      totalQuestionCount,
      classifiedQuestionCount,
      unclassifiedQuestionCount,
      invalidLatestAnswerCount,
      status:
        classifiedQuestionCount === 0
          ? 'none'
          : classifiedQuestionCount === totalQuestionCount
            ? 'complete'
            : 'partial',
      qualityStatus: invalidLatestAnswerCount === 0 ? 'clean' : 'invalid-data-excluded',
    },
    confidenceLevels,
    outcomes,
    review: {
      advanceQuestionCount,
      reviewQuestionCount: classifiedQuestionCount - advanceQuestionCount,
      highlightedQuestionCount: highlightedOutcomes.reduce(
        (total, outcome) => total + outcome.questionCount,
        0
      ),
      highlightedOutcomes,
    },
    classifiedItems,
  };
}

function collectValidQuestionIds(questions) {
  const seen = new Set();
  const questionIds = [];
  for (const question of Array.isArray(questions) ? questions : []) {
    if (!isPlainObject(question)) continue;
    const questionId = typeof question.id === 'string' ? question.id.trim() : '';
    if (!questionId || seen.has(questionId)) continue;
    seen.add(questionId);
    questionIds.push(questionId);
  }
  return questionIds;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
