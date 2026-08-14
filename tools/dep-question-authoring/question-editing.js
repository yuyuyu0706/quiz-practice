const CHOICE_KEYS = ['A', 'B', 'C', 'D'];

export const SECTION_TITLES = Object.freeze({
  1: 'Developing Code for Data Processing using Python and SQL',
  2: 'Data Ingestion & Acquisition',
  3: 'Data Transformation, Cleansing, and Quality',
  4: 'Data Sharing and Federation',
  5: 'Monitoring and Alerting',
  6: 'Cost & Performance Optimisation',
  7: 'Ensuring Data Security and Compliance',
  8: 'Data Governance',
  9: 'Debugging and Deploying',
  10: 'Data Modelling',
});

export function cloneQuestionValue(value) {
  return value == null ? value : structuredClone(value);
}

export function createQuestionDraft(question = null) {
  return {
    id: question?.id ?? '',
    section: String(question?.section ?? '1'),
    domain: question?.domain ?? '',
    tags: Array.isArray(question?.tags) ? question.tags.join('\n') : '',
    difficulty: question?.difficulty ?? '',
    sourceType: question?.sourceType ?? '',
    scenarioType: question?.scenarioType ?? '',
    estimatedTimeSec: question?.estimatedTimeSec == null ? '' : String(question.estimatedTimeSec),
    question: question?.question ?? '',
    choices: Object.fromEntries(CHOICE_KEYS.map((key) => [key, question?.choices?.[key] ?? ''])),
    answer: question?.answer ?? 'A',
    explanation: question?.explanation ?? '',
    whyWrong: Object.fromEntries(CHOICE_KEYS.map((key) => [key, question?.whyWrong?.[key] ?? ''])),
    references: question?.references?.length
      ? question.references.map((reference) => ({ ...reference }))
      : [{ title: '', url: '' }],
    notes: question?.notes ?? '',
  };
}

export function validateQuestionDraft(draft, questions = [], editingId = null) {
  const errors = {};
  const required = ['id', 'section', 'question', 'explanation'];
  required.forEach((field) => {
    if (!String(draft[field] ?? '').trim()) errors[field] = 'Required';
  });
  CHOICE_KEYS.forEach((key) => {
    if (!String(draft.choices?.[key] ?? '').trim()) errors[`choice-${key}`] = 'Required';
  });
  if (!CHOICE_KEYS.includes(draft.answer)) errors.answer = 'A / B / C / Dを選択してください。';
  if (!editingId && questions.some((question) => question.id === String(draft.id).trim())) {
    errors.id = 'Question ID already exists.';
  }
  if (draft.estimatedTimeSec !== '' && !/^[1-9]\d*$/.test(String(draft.estimatedTimeSec))) {
    errors.estimatedTimeSec = 'Positive integerを入力してください。';
  }
  draft.references?.forEach((reference, index) => {
    const title = String(reference.title ?? '').trim();
    const url = String(reference.url ?? '').trim();
    if (Boolean(title) !== Boolean(url))
      errors[`reference-${index}`] = 'TitleとURLを両方入力してください。';
  });
  return errors;
}

function optionalText(target, field, value) {
  const normalized = String(value ?? '').trim();
  if (normalized) target[field] = normalized;
  else delete target[field];
}

function serializeEditable(draft) {
  const question = {
    id: String(draft.id).trim(),
    section: String(draft.section),
    sectionTitle: SECTION_TITLES[draft.section],
    question: String(draft.question).trim(),
    choices: Object.fromEntries(CHOICE_KEYS.map((key) => [key, String(draft.choices[key]).trim()])),
    answer: draft.answer,
    explanation: String(draft.explanation).trim(),
  };
  ['domain', 'difficulty', 'sourceType', 'scenarioType', 'notes'].forEach((field) =>
    optionalText(question, field, draft[field])
  );
  const tags = String(draft.tags ?? '')
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length) question.tags = tags;
  if (draft.estimatedTimeSec !== '') question.estimatedTimeSec = Number(draft.estimatedTimeSec);
  const whyWrong = Object.fromEntries(
    CHOICE_KEYS.filter(
      (key) => key !== draft.answer && String(draft.whyWrong?.[key] ?? '').trim()
    ).map((key) => [key, String(draft.whyWrong[key]).trim()])
  );
  if (Object.keys(whyWrong).length) question.whyWrong = whyWrong;
  const references = (draft.references ?? [])
    .map(({ title, url }) => ({ title: String(title ?? '').trim(), url: String(url ?? '').trim() }))
    .filter(({ title, url }) => title || url);
  if (references.length) question.references = references;
  return question;
}

export function createQuestion(questions, draft) {
  const errors = validateQuestionDraft(draft, questions);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  return [...cloneQuestionValue(questions), serializeEditable(draft)];
}

export function updateQuestion(questions, questionId, draft) {
  const index = questions.findIndex((question) => question.id === questionId);
  if (index < 0) throw new Error(`Question not found: ${questionId}`);
  const normalizedDraft = { ...draft, id: questionId };
  const errors = validateQuestionDraft(normalizedDraft, questions, questionId);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const next = cloneQuestionValue(questions);
  const editable = serializeEditable(normalizedDraft);
  const preserved = next[index];
  const editableFields = [
    'section',
    'sectionTitle',
    'domain',
    'tags',
    'difficulty',
    'sourceType',
    'scenarioType',
    'estimatedTimeSec',
    'question',
    'choices',
    'answer',
    'explanation',
    'whyWrong',
    'references',
    'notes',
  ];
  editableFields.forEach((field) => delete preserved[field]);
  next[index] = { ...preserved, ...editable, id: questionId };
  return next;
}
