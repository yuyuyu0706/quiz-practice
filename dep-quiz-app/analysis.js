import { normalizeProgressEntry } from './notes.js';

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
