import { normalizeProgressEntry, WRONG_REASON_TAGS } from './notes.js';

export function prepareWeaknessAnalysisInput(questions, progress) {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const safeProgress = isPlainObject(progress) ? progress : {};
  const seenQuestionIds = new Set();
  const sectionsById = new Map();
  const validQuestions = [];

  safeQuestions.forEach((question) => {
    if (!isPlainObject(question)) return;

    const questionId = normalizeRequiredString(question.id);
    const section = normalizeRequiredString(question.section);
    if (!questionId || !section || seenQuestionIds.has(questionId)) return;

    seenQuestionIds.add(questionId);
    validQuestions.push({ questionId, section });

    const sectionTitle = normalizeOptionalString(question.sectionTitle);
    if (!sectionsById.has(section)) {
      sectionsById.set(section, {
        section,
        sectionTitle,
        questionIds: [],
        totalQuestionCount: 0,
      });
    }

    const sectionItem = sectionsById.get(section);
    if (!sectionItem.sectionTitle && sectionTitle) {
      sectionItem.sectionTitle = sectionTitle;
    }
    sectionItem.questionIds.push(questionId);
    sectionItem.totalQuestionCount += 1;
  });

  const questionItems = validQuestions.map(({ questionId, section }) => {
    const normalizedProgress = normalizeProgressEntry(safeProgress[questionId]);
    return {
      questionId,
      section,
      sectionTitle: sectionsById.get(section)?.sectionTitle ?? '',
      progress: {
        seenCount: normalizedProgress.seenCount,
        correctCount: normalizedProgress.correctCount,
        wrongCount: normalizedProgress.wrongCount,
        lastAnsweredAt: normalizedProgress.lastAnsweredAt,
        bookmark: normalizedProgress.bookmark,
        hasNote: normalizedProgress.noteText.trim().length > 0,
        wrongReasonTags: normalizedProgress.wrongReasonTags,
      },
    };
  });

  const sections = [...sectionsById.values()]
    .sort((a, b) => compareSections(a.section, b.section))
    .map((section) => ({
      section: section.section,
      sectionTitle: section.sectionTitle,
      questionIds: [...section.questionIds],
      totalQuestionCount: section.totalQuestionCount,
    }));

  return { questionItems, sections };
}

export function buildBasicWeaknessSummary(analysisInput) {
  const questionItems = Array.isArray(analysisInput?.questionItems)
    ? analysisInput.questionItems
    : [];
  const sections = Array.isArray(analysisInput?.sections) ? analysisInput.sections : [];
  const questionItemsBySection = new Map();

  questionItems.forEach((questionItem) => {
    const section = normalizeRequiredString(questionItem?.section);
    if (!section) return;

    if (!questionItemsBySection.has(section)) {
      questionItemsBySection.set(section, []);
    }
    questionItemsBySection.get(section).push(questionItem);
  });

  return {
    overall: summarizeQuestionItems(questionItems),
    sections: sections.map((sectionItem) => {
      const section = normalizeRequiredString(sectionItem?.section);
      const sectionQuestionItems = questionItemsBySection.get(section) ?? [];
      return {
        section,
        sectionTitle: normalizeOptionalString(sectionItem?.sectionTitle),
        ...summarizeQuestionItems(sectionQuestionItems),
      };
    }),
    tags: summarizeWrongReasonTags(questionItems),
  };
}

function summarizeQuestionItems(questionItems) {
  const summary = {
    totalQuestionCount: 0,
    answeredQuestionCount: 0,
    totalAttemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
    accuracyRate: null,
    taggedQuestionCount: 0,
  };

  questionItems.forEach((questionItem) => {
    const progress = isPlainObject(questionItem?.progress) ? questionItem.progress : {};
    const seenCount = normalizeSummaryCount(progress.seenCount);
    const correctCount = normalizeSummaryCount(progress.correctCount);
    const wrongCount = normalizeSummaryCount(progress.wrongCount);
    const wrongReasonTags = Array.isArray(progress.wrongReasonTags) ? progress.wrongReasonTags : [];

    summary.totalQuestionCount += 1;
    if (seenCount > 0) summary.answeredQuestionCount += 1;
    summary.totalAttemptCount += seenCount;
    summary.correctCount += correctCount;
    summary.wrongCount += wrongCount;
    if (wrongReasonTags.length > 0) summary.taggedQuestionCount += 1;
  });

  summary.accuracyRate =
    summary.totalAttemptCount > 0 ? summary.correctCount / summary.totalAttemptCount : null;

  return summary;
}

function summarizeWrongReasonTags(questionItems) {
  const taggedQuestionCounts = new Map(WRONG_REASON_TAGS.map((tag) => [tag.id, 0]));

  questionItems.forEach((questionItem) => {
    const wrongReasonTags = Array.isArray(questionItem?.progress?.wrongReasonTags)
      ? questionItem.progress.wrongReasonTags
      : [];
    const uniqueTags = new Set(wrongReasonTags);

    WRONG_REASON_TAGS.forEach((tag) => {
      if (uniqueTags.has(tag.id)) {
        taggedQuestionCounts.set(tag.id, taggedQuestionCounts.get(tag.id) + 1);
      }
    });
  });

  return WRONG_REASON_TAGS.map((tag) => ({
    id: tag.id,
    label: tag.label,
    taggedQuestionCount: taggedQuestionCounts.get(tag.id),
  }));
}

function normalizeSummaryCount(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function normalizeRequiredString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareSections(sectionA, sectionB) {
  const numberA = Number(sectionA);
  const numberB = Number(sectionB);
  const bothNumeric = Number.isFinite(numberA) && Number.isFinite(numberB);
  if (bothNumeric && numberA !== numberB) return numberA - numberB;
  return sectionA.localeCompare(sectionB, 'ja');
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
