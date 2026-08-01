import { appendConfidenceAttempt, createConfidenceAttempt } from './confidence-history.js';
import { applyConfidenceAnswerResult } from './progress.js';

export function buildConfidenceAnswerCommitPlan({
  progress,
  confidenceHistory,
  attemptId,
  questionId,
  section,
  result,
  confidence,
  answeredAt,
}) {
  const attempt = createConfidenceAttempt({
    attemptId,
    questionId,
    section,
    result,
    confidence,
    answeredAt,
  });
  const historyResult = appendConfidenceAttempt(confidenceHistory, attempt);
  if (historyResult.added !== true) {
    throw new Error('Confidence attempt was not added');
  }

  const nextProgress = applyConfidenceAnswerResult(progress, questionId, {
    result,
    confidence,
    answeredAt,
  });

  return {
    attempt,
    nextProgress,
    nextHistory: historyResult.nextHistory,
    trimmedCount: historyResult.trimmedCount,
  };
}
