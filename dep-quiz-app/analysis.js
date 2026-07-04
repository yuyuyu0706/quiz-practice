import { normalizeProgressEntry, WRONG_REASON_TAGS } from './notes.js';

const DEFAULT_MIN_ANSWERED_QUESTION_COUNT = 3;

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

export function buildWeaknessAssessment(basicSummary, options) {
  const minAnsweredQuestionCount = normalizeMinAnsweredQuestionCount(
    options?.minAnsweredQuestionCount
  );
  const overallSummary = isPlainObject(basicSummary?.overall) ? basicSummary.overall : {};
  const sectionSummaries = Array.isArray(basicSummary?.sections) ? basicSummary.sections : [];
  const tagSummaries = Array.isArray(basicSummary?.tags) ? basicSummary.tags : [];

  const sections = sectionSummaries.map((sectionSummary) => ({
    section: normalizeOptionalString(sectionSummary?.section),
    sectionTitle: normalizeOptionalString(sectionSummary?.sectionTitle),
    analysisStatus: getAnalysisStatus(
      sectionSummary?.answeredQuestionCount,
      minAnsweredQuestionCount
    ),
    answeredQuestionCount: normalizeSummaryCount(sectionSummary?.answeredQuestionCount),
    minAnsweredQuestionCount,
  }));

  return {
    criteria: {
      minAnsweredQuestionCount,
    },
    overall: {
      analysisStatus: getAnalysisStatus(
        overallSummary?.answeredQuestionCount,
        minAnsweredQuestionCount
      ),
      answeredQuestionCount: normalizeSummaryCount(overallSummary?.answeredQuestionCount),
      minAnsweredQuestionCount,
    },
    sections,
    priorities: {
      section: selectPrioritySection(sectionSummaries, sections),
      tag: selectPriorityTag(tagSummaries),
    },
  };
}

export function buildWeaknessAnalysis(questions, progress, options) {
  const analysisInput = prepareWeaknessAnalysisInput(questions, progress);
  const basicSummary = buildBasicWeaknessSummary(analysisInput);
  const qualitySummary = normalizeWeaknessSummaryQuality(basicSummary);
  const assessment = buildWeaknessAssessment(qualitySummary, options);

  return {
    criteria: {
      minAnsweredQuestionCount: assessment.criteria.minAnsweredQuestionCount,
    },
    overall: {
      ...qualitySummary.overall,
      analysisStatus: assessment.overall.analysisStatus,
      minAnsweredQuestionCount: assessment.overall.minAnsweredQuestionCount,
    },
    sections: qualitySummary.sections.map((sectionSummary, index) => ({
      ...sectionSummary,
      analysisStatus: assessment.sections[index]?.analysisStatus ?? 'unstarted',
      minAnsweredQuestionCount:
        assessment.sections[index]?.minAnsweredQuestionCount ??
        assessment.criteria.minAnsweredQuestionCount,
    })),
    tags: qualitySummary.tags.map((tagSummary) => ({ ...tagSummary })),
    priorities: assessment.priorities,
  };
}

function normalizeWeaknessSummaryQuality(basicSummary) {
  const overallSummary = isPlainObject(basicSummary?.overall) ? basicSummary.overall : {};
  const sectionSummaries = Array.isArray(basicSummary?.sections) ? basicSummary.sections : [];
  const tagSummaries = Array.isArray(basicSummary?.tags) ? basicSummary.tags : [];

  return {
    overall: normalizeSummaryItemAccuracyQuality(overallSummary),
    sections: sectionSummaries.map((sectionSummary) => ({
      section: normalizeOptionalString(sectionSummary?.section),
      sectionTitle: normalizeOptionalString(sectionSummary?.sectionTitle),
      ...normalizeSummaryItemAccuracyQuality(sectionSummary),
    })),
    tags: tagSummaries.map((tagSummary) => ({
      id: normalizeOptionalString(tagSummary?.id),
      label: normalizeOptionalString(tagSummary?.label),
      taggedQuestionCount: normalizeSummaryCount(tagSummary?.taggedQuestionCount),
    })),
  };
}

function normalizeSummaryItemAccuracyQuality(summaryItem) {
  const totalQuestionCount = normalizeSummaryCount(summaryItem?.totalQuestionCount);
  const answeredQuestionCount = normalizeSummaryCount(summaryItem?.answeredQuestionCount);
  const totalAttemptCount = normalizeSummaryCount(summaryItem?.totalAttemptCount);
  const correctCount = normalizeSummaryCount(summaryItem?.correctCount);
  const wrongCount = normalizeSummaryCount(summaryItem?.wrongCount);
  const taggedQuestionCount = normalizeSummaryCount(summaryItem?.taggedQuestionCount);
  const { accuracyRate, accuracyRateStatus } = evaluateAccuracyRateQuality({
    totalAttemptCount,
    correctCount,
    wrongCount,
  });

  return {
    totalQuestionCount,
    answeredQuestionCount,
    totalAttemptCount,
    correctCount,
    wrongCount,
    accuracyRate,
    accuracyRateStatus,
    taggedQuestionCount,
  };
}

function evaluateAccuracyRateQuality({ totalAttemptCount, correctCount, wrongCount }) {
  if (totalAttemptCount > 0 && correctCount + wrongCount === totalAttemptCount) {
    return {
      accuracyRate: correctCount / totalAttemptCount,
      accuracyRateStatus: 'available',
    };
  }

  if (totalAttemptCount === 0 && correctCount === 0 && wrongCount === 0) {
    return {
      accuracyRate: null,
      accuracyRateStatus: 'not-applicable',
    };
  }

  return {
    accuracyRate: null,
    accuracyRateStatus: 'inconsistent-counts',
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

function selectPrioritySection(sectionSummaries, assessedSections) {
  const candidate = sectionSummaries
    .map((sectionSummary, index) => ({
      index,
      summary: sectionSummary,
      assessment: assessedSections[index],
    }))
    .filter(
      ({ summary, assessment }) =>
        assessment?.analysisStatus === 'ready' && normalizeSummaryCount(summary?.wrongCount) > 0
    )
    .sort((a, b) => comparePrioritySections(a, b))[0];

  if (candidate) {
    return {
      item: buildPrioritySectionItem(candidate.summary),
      reasonCode: 'highest-wrong-count',
    };
  }

  if (assessedSections.every((section) => section.analysisStatus === 'unstarted')) {
    return { item: null, reasonCode: 'not-started' };
  }

  if (!assessedSections.some((section) => section.analysisStatus === 'ready')) {
    return { item: null, reasonCode: 'not-enough-data' };
  }

  return { item: null, reasonCode: 'no-wrong-answers' };
}

function comparePrioritySections(a, b) {
  const wrongCountDiff =
    normalizeSummaryCount(b.summary?.wrongCount) - normalizeSummaryCount(a.summary?.wrongCount);
  if (wrongCountDiff !== 0) return wrongCountDiff;

  const accuracyRateDiff =
    normalizeComparableAccuracyRate(a.summary?.accuracyRate) -
    normalizeComparableAccuracyRate(b.summary?.accuracyRate);
  if (accuracyRateDiff !== 0) return accuracyRateDiff;

  const totalAttemptCountDiff =
    normalizeSummaryCount(b.summary?.totalAttemptCount) -
    normalizeSummaryCount(a.summary?.totalAttemptCount);
  if (totalAttemptCountDiff !== 0) return totalAttemptCountDiff;

  return a.index - b.index;
}

function buildPrioritySectionItem(sectionSummary) {
  return {
    section: normalizeOptionalString(sectionSummary?.section),
    sectionTitle: normalizeOptionalString(sectionSummary?.sectionTitle),
    answeredQuestionCount: normalizeSummaryCount(sectionSummary?.answeredQuestionCount),
    totalAttemptCount: normalizeSummaryCount(sectionSummary?.totalAttemptCount),
    correctCount: normalizeSummaryCount(sectionSummary?.correctCount),
    wrongCount: normalizeSummaryCount(sectionSummary?.wrongCount),
    accuracyRate: normalizeAccuracyRate(sectionSummary?.accuracyRate),
    accuracyRateStatus: normalizeAccuracyRateStatus(sectionSummary?.accuracyRateStatus),
  };
}

function selectPriorityTag(tagSummaries) {
  const candidate = tagSummaries
    .map((tagSummary, index) => ({ index, tagSummary }))
    .filter(({ tagSummary }) => normalizeSummaryCount(tagSummary?.taggedQuestionCount) > 0)
    .sort((a, b) => {
      const taggedQuestionCountDiff =
        normalizeSummaryCount(b.tagSummary?.taggedQuestionCount) -
        normalizeSummaryCount(a.tagSummary?.taggedQuestionCount);
      if (taggedQuestionCountDiff !== 0) return taggedQuestionCountDiff;
      return a.index - b.index;
    })[0];

  if (!candidate) {
    return { item: null, reasonCode: 'no-tagged-questions' };
  }

  return {
    item: {
      id: normalizeOptionalString(candidate.tagSummary?.id),
      label: normalizeOptionalString(candidate.tagSummary?.label),
      taggedQuestionCount: normalizeSummaryCount(candidate.tagSummary?.taggedQuestionCount),
    },
    reasonCode: 'highest-tagged-question-count',
  };
}

function getAnalysisStatus(answeredQuestionCount, minAnsweredQuestionCount) {
  const normalizedAnsweredQuestionCount = normalizeSummaryCount(answeredQuestionCount);
  if (normalizedAnsweredQuestionCount === 0) return 'unstarted';
  if (normalizedAnsweredQuestionCount < minAnsweredQuestionCount) return 'insufficient';
  return 'ready';
}

function normalizeMinAnsweredQuestionCount(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_MIN_ANSWERED_QUESTION_COUNT;
}

function normalizeAccuracyRate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeComparableAccuracyRate(value) {
  const accuracyRate = normalizeAccuracyRate(value);
  return accuracyRate === null ? Number.POSITIVE_INFINITY : accuracyRate;
}

function normalizeAccuracyRateStatus(value) {
  return ['available', 'not-applicable', 'inconsistent-counts'].includes(value)
    ? value
    : 'not-applicable';
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
