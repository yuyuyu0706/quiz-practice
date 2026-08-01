import { getConfidenceOutcome } from './confidence-outcome.js';
import { selectConfidenceHistoryAttempts } from './confidence-history-summary.js';

const CHANGE_TYPES = Object.freeze([
  'misconception-corrected',
  'unstable-correctness-stabilized',
  'review-to-advance',
]);

export function buildConfidenceHistoryTrend(history, query) {
  const selected = selectConfidenceHistoryAttempts(history, query);
  const timeline =
    selected.query.period === 'all' && selected.query.sectionId === null
      ? selected
      : selectConfidenceHistoryAttempts(history, {
          period: 'all',
          sectionId: null,
          asOf: selected.query.asOf,
        });
  const selectedIds = new Set(selected.attempts.map(({ attemptId }) => attemptId));
  const selectedByQuestion = groupAttempts(selected.attempts);
  const timelineByQuestion = groupAttempts(timeline.attempts);
  const changeEvents = [];
  const previousByQuestion = new Map();
  let transitionCount = 0;

  for (const toAttempt of timeline.attempts) {
    const fromAttempt = previousByQuestion.get(toAttempt.questionId);
    previousByQuestion.set(toAttempt.questionId, toAttempt);
    if (
      fromAttempt === undefined ||
      !selectedIds.has(toAttempt.attemptId) ||
      !matchesSectionPair(fromAttempt, toAttempt, selected.query.sectionId)
    ) {
      continue;
    }

    transitionCount += 1;
    const fromOutcome = outcomeFor(fromAttempt);
    const toOutcome = outcomeFor(toAttempt);
    const changeTypes = deriveChangeTypes(fromOutcome, toOutcome);
    if (changeTypes.length === 0) continue;

    changeEvents.push({
      questionId: toAttempt.questionId,
      section: toAttempt.section,
      fromAttemptId: fromAttempt.attemptId,
      toAttemptId: toAttempt.attemptId,
      fromOutcomeId: fromOutcome.id,
      toOutcomeId: toOutcome.id,
      changedAt: toAttempt.answeredAt,
      changeTypes,
    });
  }

  const eventTypesByQuestion = new Map();
  for (const event of changeEvents) {
    let types = eventTypesByQuestion.get(event.questionId);
    if (types === undefined) {
      types = new Set();
      eventTypesByQuestion.set(event.questionId, types);
    }
    event.changeTypes.forEach((type) => types.add(type));
  }

  const questionTrends = [...selectedByQuestion.entries()].map(([questionId, attempts]) => {
    const firstAttempt = attempts[0];
    const latestAttempt = attempts.at(-1);
    const firstOutcome = outcomeFor(firstAttempt);
    const latestOutcome = outcomeFor(latestAttempt);
    const presentTypes = eventTypesByQuestion.get(questionId) ?? new Set();
    return {
      questionId,
      section: latestAttempt.section,
      attemptCount: attempts.length,
      firstOutcomeId: firstOutcome.id,
      latestOutcomeId: latestOutcome.id,
      latestGuidance: latestOutcome.guidance,
      reviewStreakCount: countReviewStreak(
        latestAttempt,
        timelineByQuestion.get(questionId),
        selectedIds,
        selected.query
      ),
      latestAnsweredAt: latestAttempt.answeredAt,
      changeTypes: CHANGE_TYPES.filter((type) => presentTypes.has(type)),
    };
  });

  const changedQuestionIds = new Set(changeEvents.map(({ questionId }) => questionId));
  const countEventsWith = (type) =>
    changeEvents.filter(({ changeTypes }) => changeTypes.includes(type)).length;
  return {
    trends: {
      analyzedQuestionCount: questionTrends.length,
      transitionCount,
      changedQuestionCount: changedQuestionIds.size,
      misconceptionCorrectedCount: countEventsWith('misconception-corrected'),
      unstableCorrectnessStabilizedCount: countEventsWith('unstable-correctness-stabilized'),
      reviewToAdvanceCount: countEventsWith('review-to-advance'),
      continuedReviewQuestionCount: questionTrends.filter(
        ({ latestGuidance, reviewStreakCount }) =>
          latestGuidance === 'review' && reviewStreakCount >= 2
      ).length,
    },
    questionTrends,
    changeEvents,
  };
}

function groupAttempts(attempts) {
  const groups = new Map();
  for (const attempt of attempts) {
    if (!groups.has(attempt.questionId)) groups.set(attempt.questionId, []);
    groups.get(attempt.questionId).push(attempt);
  }
  return groups;
}

function matchesSectionPair(fromAttempt, toAttempt, sectionId) {
  return (
    sectionId === null || (fromAttempt.section === sectionId && toAttempt.section === sectionId)
  );
}

function outcomeFor(attempt) {
  return getConfidenceOutcome(attempt.result, attempt.confidence);
}

function deriveChangeTypes(fromOutcome, toOutcome) {
  const matched = new Set();
  if (fromOutcome.id === 'wrong_high' && toOutcome.id === 'correct_high') {
    matched.add('misconception-corrected');
  }
  if (fromOutcome.id === 'correct_low' && toOutcome.id === 'correct_high') {
    matched.add('unstable-correctness-stabilized');
  }
  if (fromOutcome.guidance === 'review' && toOutcome.guidance === 'advance') {
    matched.add('review-to-advance');
  }
  return CHANGE_TYPES.filter((type) => matched.has(type));
}

function countReviewStreak(latestAttempt, timeline, selectedIds, query) {
  if (outcomeFor(latestAttempt).guidance !== 'review') return 0;

  const latestIndex = timeline.findIndex(({ attemptId }) => attemptId === latestAttempt.attemptId);
  let count = 1;
  for (let index = latestIndex - 1; index >= 0; index -= 1) {
    const attempt = timeline[index];
    if (query.sectionId !== null && attempt.section !== query.sectionId) break;

    const isSelected = selectedIds.has(attempt.attemptId);
    const isBaseline = query.period !== 'all' && !isSelected;
    if (!isSelected && !isBaseline) break;
    if (outcomeFor(attempt).guidance !== 'review') break;

    count += 1;
    if (isBaseline) break;
  }
  return count;
}
