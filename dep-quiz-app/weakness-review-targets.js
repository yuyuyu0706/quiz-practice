import { normalizeProgressEntry, WRONG_REASON_TAGS } from './notes.js';

const NO_MATCHING_QUESTIONS = 'NO_MATCHING_QUESTIONS';

export function buildWeaknessReviewTargetPlan({ questions, progress, condition } = {}) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeProgress = isPlainObject(progress) ? progress : {};
  const normalizedCondition = normalizeCondition(condition, safeQuestions);
  const questionIds = new Set();
  const validQuestions = [];

  safeQuestions.forEach((question) => {
    if (!isPlainObject(question)) return;
    const id = normalizeRequiredString(question.id);
    const section = normalizeRequiredString(question.section);
    if (!id || !section || questionIds.has(id)) return;

    questionIds.add(id);
    validQuestions.push({
      raw: question,
      id,
      section,
      sectionTitle: normalizeOptionalString(question.sectionTitle),
      questionText: normalizeQuestionText(question),
    });
  });

  const items = validQuestions
    .filter((question) => isTargetQuestion(question, safeProgress, normalizedCondition))
    .map((question) => buildTargetItem(question, safeProgress));

  return {
    condition: normalizedCondition,
    targetCount: items.length,
    items,
    emptyState: items.length === 0 ? { reasonCode: NO_MATCHING_QUESTIONS } : null,
    unavailableProgressIds: Object.keys(safeProgress).filter(
      (questionId) => !questionIds.has(questionId)
    ),
  };
}

function normalizeCondition(condition, questions) {
  if (!isPlainObject(condition)) {
    throw new TypeError('condition must be an object');
  }

  if (condition.type === 'section') {
    const section = normalizeRequiredString(condition.section ?? condition.value);
    if (!section) throw new TypeError('section condition requires a section');
    const sectionTitle = findSectionTitle(questions, section);
    return {
      type: 'section',
      value: section,
      label: sectionTitle ? `Section ${section}：${sectionTitle}` : `Section ${section}`,
    };
  }

  if (condition.type === 'wrongReasonTag') {
    const tagId = normalizeRequiredString(condition.tag ?? condition.value);
    const tagDefinition = WRONG_REASON_TAGS.find((tag) => tag.id === tagId);
    if (!tagDefinition) throw new TypeError('wrongReasonTag condition requires a known tag');
    return {
      type: 'wrongReasonTag',
      value: tagDefinition.id,
      label: tagDefinition.label,
    };
  }

  throw new TypeError(`Unsupported weakness review target condition type: ${condition.type}`);
}

function isTargetQuestion(question, progress, condition) {
  if (condition.type === 'section') {
    return question.section === condition.value;
  }

  const normalizedProgress = normalizeProgressEntry(progress[question.id]);
  return normalizedProgress.wrongReasonTags.includes(condition.value);
}

function buildTargetItem(question, progress) {
  const normalizedProgress = normalizeProgressEntry(progress[question.id]);
  const status = getStatus(normalizedProgress);

  return {
    id: question.id,
    section: question.section,
    sectionTitle: question.sectionTitle,
    questionText: question.questionText,
    status,
    seenCount: normalizedProgress.seenCount,
    correctCount: normalizedProgress.correctCount,
    wrongCount: normalizedProgress.wrongCount,
    wrongReasonTags: [...normalizedProgress.wrongReasonTags],
    hasWrongReasonTags: normalizedProgress.wrongReasonTags.length > 0,
    hasNote: hasProgressNote(progress[question.id]),
    bookmarked: normalizedProgress.bookmark === true,
  };
}

function hasProgressNote(progressEntry) {
  if (!isPlainObject(progressEntry)) return false;
  return ['noteText', 'note', 'memo'].some(
    (key) => typeof progressEntry[key] === 'string' && progressEntry[key].trim().length > 0
  );
}

function getStatus({ seenCount, correctCount, wrongCount }) {
  if (wrongCount > 0) return 'wrong';
  if (correctCount > 0) return 'correct';
  if (seenCount > 0) return 'answered';
  return 'unseen';
}

function findSectionTitle(questions, section) {
  const question = questions.find(
    (item) =>
      isPlainObject(item) &&
      normalizeRequiredString(item.section) === section &&
      normalizeOptionalString(item.sectionTitle)
  );
  return question ? normalizeOptionalString(question.sectionTitle) : '';
}

function normalizeQuestionText(question) {
  return normalizeOptionalString(question.question ?? question.prompt ?? question.text);
}

function normalizeRequiredString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
