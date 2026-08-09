/**
 * Applies the session's section and mode eligibility rules without mutating input.
 * Representative selection, shuffling and count limiting intentionally happen later.
 */
export function filterEligibleQuestionsForSession(questions, settings, mode, progress, hasNoteFn) {
  let eligible = questions.filter((question) => settings.sections.includes(question.section));

  if (mode === 'wrongOnly') {
    eligible = eligible.filter((question) => (progress?.[question.id]?.wrongCount ?? 0) > 0);
  } else if (mode === 'bookmarks') {
    eligible = eligible.filter((question) => progress?.[question.id]?.bookmark);
  } else if (mode === 'notesOnly') {
    eligible = eligible.filter((question) => hasNoteFn(progress, question.id));
  }

  return eligible;
}
