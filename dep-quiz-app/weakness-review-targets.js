import { normalizeProgressEntry, WRONG_REASON_TAGS } from './notes.js';
import { CONFIDENCE_LEVELS } from './confidence.js';
import { CONFIDENCE_OUTCOMES, getConfidenceOutcomeById } from './confidence-outcome.js';

const NO_MATCHING_QUESTIONS = 'NO_MATCHING_QUESTIONS';

export function buildWeaknessReviewTargetPlan({
  questions,
  progress,
  condition,
  confidenceAnalysis,
} = {}) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeProgress = isPlainObject(progress) ? progress : {};
  const normalizedCondition = normalizeCondition(condition, safeQuestions);
  const confidenceItems = collectConfidenceItems(confidenceAnalysis);
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
    .filter((question) =>
      isTargetQuestion(question, safeProgress, normalizedCondition, confidenceItems)
    )
    .map((question) => buildTargetItem(question, safeProgress, confidenceItems.get(question.id)));

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

  if (condition.type === 'confidenceOutcome') {
    const outcomeId = normalizeRequiredString(condition.outcome ?? condition.value);
    const outcome = getConfidenceOutcomeById(outcomeId);
    if (!outcome) throw new TypeError('confidenceOutcome condition requires a known outcome');
    return { type: 'confidenceOutcome', value: outcome.id, label: outcome.title };
  }

  if (condition.type === 'confidenceGuidance') {
    const guidance = normalizeRequiredString(condition.guidance ?? condition.value);
    const knownGuidance = CONFIDENCE_OUTCOMES.some((outcome) => outcome.guidance === guidance);
    if (!knownGuidance || guidance !== 'review') {
      throw new TypeError('confidenceGuidance condition requires the review guidance');
    }
    return { type: 'confidenceGuidance', value: guidance, label: '要確認（5分類）' };
  }

  throw new TypeError(`Unsupported weakness review target condition type: ${condition.type}`);
}

function isTargetQuestion(question, progress, condition, confidenceItems) {
  if (condition.type === 'section') {
    return question.section === condition.value;
  }

  if (condition.type === 'wrongReasonTag') {
    const normalizedProgress = normalizeProgressEntry(progress[question.id]);
    return normalizedProgress.wrongReasonTags.includes(condition.value);
  }

  const latest = confidenceItems.get(question.id);
  return condition.type === 'confidenceOutcome'
    ? latest?.outcomeId === condition.value
    : latest?.guidance === condition.value;
}

function buildTargetItem(question, progress, confidenceItem) {
  const normalizedProgress = normalizeProgressEntry(progress[question.id]);
  const status = getStatus(normalizedProgress);

  const item = {
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
  if (confidenceItem) item.latestUnderstanding = buildLatestUnderstanding(confidenceItem);
  return item;
}

function collectConfidenceItems(confidenceAnalysis) {
  const items =
    isPlainObject(confidenceAnalysis) && Array.isArray(confidenceAnalysis.classifiedItems)
      ? confidenceAnalysis.classifiedItems
      : [];
  const result = new Map();
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const questionId = normalizeRequiredString(item.questionId);
    const outcome = getConfidenceOutcomeById(normalizeRequiredString(item.outcomeId));
    if (
      !questionId ||
      result.has(questionId) ||
      !outcome ||
      item.result !== outcome.result ||
      item.confidence !== outcome.confidence ||
      item.guidance !== outcome.guidance
    )
      continue;
    result.set(questionId, { ...item, questionId, outcomeId: outcome.id });
  }
  return result;
}

function buildLatestUnderstanding(item) {
  const outcome = getConfidenceOutcomeById(item.outcomeId);
  const confidence = CONFIDENCE_LEVELS.find((level) => level.id === item.confidence);
  return {
    outcomeId: outcome.id,
    title: outcome.title,
    guidance: outcome.guidance,
    result: outcome.result,
    confidence: outcome.confidence,
    confidenceLabel: confidence?.label ?? outcome.confidence,
    answeredAt: item.answeredAt,
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
