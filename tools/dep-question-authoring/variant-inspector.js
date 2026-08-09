import {
  filterEligibleQuestionsForSession,
  getQuestionSessionEligibility,
} from '../../dep-quiz-app/question-eligibility.js';
import { hasNote } from '../../dep-quiz-app/notes.js';
import { normalizeProgressEntry } from '../../dep-quiz-app/progress.js';
import { selectVariantCandidates } from '../../dep-quiz-app/variant-selection.js';

export function inspectVariantSelection({ questions, groupId, settings, mode, progress = {} }) {
  const members = questions.filter((question) => question.variantGroup === groupId);
  const eligible = filterEligibleQuestionsForSession(members, settings, mode, progress, hasNote);
  const winner = selectVariantCandidates(eligible, progress)[0] ?? null;
  const winnerSeenCount = winner ? normalizeProgressEntry(progress[winner.id]).seenCount : null;
  const eligibleCount = eligible.length;

  return {
    groupId,
    mode,
    winnerId: winner?.id ?? null,
    randomBoundary: mode === 'random' ? 'Representative is selected before session shuffle.' : null,
    members: members.map((question) => {
      const eligibility = getQuestionSessionEligibility(
        question,
        settings,
        mode,
        progress,
        hasNote
      );
      if (!eligibility.eligible) {
        return { id: question.id, eligible: false, reason: eligibility.reason };
      }
      const seenCount = normalizeProgressEntry(progress[question.id]).seenCount;
      let reason;
      if (question.id === winner?.id) {
        reason =
          eligibleCount === 1
            ? 'only-eligible-member'
            : eligible.filter(
                  (item) => normalizeProgressEntry(progress[item.id]).seenCount === seenCount
                ).length > 1
              ? 'first-on-seen-count-tie'
              : 'least-seen';
      } else {
        reason = seenCount === winnerSeenCount ? 'later-on-seen-count-tie' : 'higher-seen-count';
      }
      return {
        id: question.id,
        eligible: true,
        selected: question.id === winner?.id,
        seenCount,
        reason,
      };
    }),
  };
}
