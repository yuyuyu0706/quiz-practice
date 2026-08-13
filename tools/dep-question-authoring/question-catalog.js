const FILTER_FIELDS = ['section', 'domain', 'difficulty', 'sourceType'];

function text(value) {
  return value == null ? '' : String(value);
}

export function buildQuestionCatalog(questions = []) {
  return questions.map((question) => ({
    id: text(question.id),
    question: text(question.question),
    section: text(question.section),
    sectionTitle: text(question.sectionTitle),
    domain: text(question.domain),
    tags: Array.isArray(question.tags) ? question.tags.map(text) : [],
    difficulty: text(question.difficulty),
    sourceType: text(question.sourceType),
    choices:
      question.choices && typeof question.choices === 'object' ? { ...question.choices } : {},
    answer: text(question.answer),
    variantGroup: text(question.variantGroup),
    followUpTargetId: text(question.followUp?.questionId),
    grouped: Boolean(question.variantGroup),
  }));
}

export function buildCatalogFilterOptions(questions = []) {
  const catalog = buildQuestionCatalog(questions);
  return Object.fromEntries(
    FILTER_FIELDS.map((field) => [
      field,
      [...new Set(catalog.map((entry) => entry[field]).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    ])
  );
}

export function filterQuestionCatalog(questions = [], filters = {}) {
  const keyword = text(filters.keyword).trim().toLocaleLowerCase();
  return buildQuestionCatalog(questions).filter((entry) => {
    const searchable = [
      entry.id,
      entry.question,
      entry.section,
      entry.sectionTitle,
      entry.domain,
      ...entry.tags,
      entry.difficulty,
      entry.sourceType,
    ];
    return (
      (!keyword || searchable.some((value) => value.toLocaleLowerCase().includes(keyword))) &&
      FILTER_FIELDS.every((field) => !filters[field] || entry[field] === filters[field])
    );
  });
}

export function reconcileSelectedQuestionId(questions = [], selectedQuestionId = null) {
  if (questions.some((question) => question.id === selectedQuestionId)) return selectedQuestionId;
  return questions[0]?.id ?? null;
}
