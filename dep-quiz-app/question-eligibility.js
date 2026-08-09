/**
 * Applies the session's section and mode eligibility rules without mutating input.
 * Representative selection, shuffling and count limiting intentionally happen later.
 */
export function filterEligibleQuestionsForSession(questions, settings, mode, progress, hasNoteFn) {
  return questions.filter(
    (question) =>
      getQuestionSessionEligibility(question, settings, mode, progress, hasNoteFn).eligible
  );
}

/**
 * Evaluates one question using the canonical session eligibility rules.
 * The reason is diagnostic metadata; `eligible` remains the filtering contract.
 */
export function getQuestionSessionEligibility(question, settings, mode, progress, hasNoteFn) {
  if (!settings.sections.includes(question.section)) {
    return { eligible: false, reason: 'section-excluded' };
  }
  if (mode === 'wrongOnly' && (progress?.[question.id]?.wrongCount ?? 0) <= 0) {
    return { eligible: false, reason: 'wrong-only-ineligible' };
  }
  if (mode === 'bookmarks' && !progress?.[question.id]?.bookmark) {
    return { eligible: false, reason: 'bookmark-ineligible' };
  }
  if (mode === 'notesOnly' && !hasNoteFn(progress, question.id)) {
    return { eligible: false, reason: 'notes-only-ineligible' };
  }
  return { eligible: true, reason: null };
}
