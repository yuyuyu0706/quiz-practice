export function buildVariantGroupIndex(questions) {
  const groups = new Map();
  questions.forEach((question) => {
    if (typeof question.variantGroup !== 'string') return;
    if (!groups.has(question.variantGroup)) {
      groups.set(question.variantGroup, { id: question.variantGroup, members: [] });
    }
    groups.get(question.variantGroup).members.push(question);
  });
  return [...groups.values()];
}

export function searchVariantAuthoringQuestions(questions, query) {
  const normalizedQuery = String(query ?? '')
    .trim()
    .toLocaleLowerCase();
  if (!normalizedQuery) return [...questions];
  return questions.filter((question) =>
    [question.id, question.question, question.variantGroup].some((value) =>
      String(value ?? '')
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    )
  );
}

export function searchVariantGroups(questions, query) {
  const groups = buildVariantGroupIndex(questions);
  const matchingGroupIds = new Set(
    searchVariantAuthoringQuestions(questions, query)
      .map((question) => question.variantGroup)
      .filter((groupId) => typeof groupId === 'string')
  );
  return groups.filter((group) => matchingGroupIds.has(group.id));
}

export function getVariantGroupMembers(questions, groupId) {
  return questions.filter((question) => question.variantGroup === groupId);
}

export function getChoiceTextMultiset(question) {
  return Object.values(question.choices ?? {})
    .map((choice) => String(choice).trim())
    .sort();
}

export function buildVariantComparison(groupMembers) {
  return groupMembers.map((question) => ({
    id: question.id,
    section: question.section,
    sectionTitle: question.sectionTitle,
    question: question.question,
    answer: question.answer,
    choices: { ...question.choices },
    choiceTextMultiset: getChoiceTextMultiset(question),
    difficulty: question.difficulty,
    followUpTargetId: question.followUp?.questionId ?? null,
  }));
}
