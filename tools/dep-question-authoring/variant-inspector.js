import { filterEligibleQuestionsForSession } from '../../dep-quiz-app/question-eligibility.js';
import { hasNote } from '../../dep-quiz-app/notes.js';
import { normalizeProgressEntry } from '../../dep-quiz-app/progress.js';
import { selectVariantCandidates } from '../../dep-quiz-app/variant-selection.js';

function ineligibilityReason(question, settings, mode, progress) {
  if (!settings.sections.includes(question.section)) return 'section-excluded';
  if (mode === 'wrongOnly' && (progress[question.id]?.wrongCount ?? 0) <= 0)
    return 'wrong-only-ineligible';
  if (mode === 'bookmarks' && !progress[question.id]?.bookmark) return 'bookmark-ineligible';
  if (mode === 'notesOnly' && !hasNote(progress, question.id)) return 'notes-only-ineligible';
  return null;
}

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
      const excludedReason = ineligibilityReason(question, settings, mode, progress);
      if (excludedReason) return { id: question.id, eligible: false, reason: excludedReason };
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
