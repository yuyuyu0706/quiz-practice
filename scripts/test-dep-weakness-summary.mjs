import assert from 'node:assert/strict';

import {
  buildBasicWeaknessSummary,
  buildWeaknessAnalysis,
  buildWeaknessAssessment,
  prepareWeaknessAnalysisInput,
} from '../dep-quiz-app/analysis.js';
import { WRONG_REASON_TAGS } from '../dep-quiz-app/notes.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const tagIds = WRONG_REASON_TAGS.map((tag) => tag.id);
const [conceptGap, termConfusion, specError, codeGap, readingOverlook, choiceUnclear, careless] =
  tagIds;

function question(id, section, overrides = {}) {
  return {
    id,
    section,
    sectionTitle: `Section ${section}`,
    prompt: `Question ${id}`,
    choices: ['A', 'B'],
    answer: 0,
    explanation: `Explanation ${id}`,
    ...overrides,
  };
}

function progressEntry({
  seenCount = 0,
  correctCount = 0,
  wrongCount = 0,
  wrongReasonTags = [],
} = {}) {
  return {
    seenCount,
    correctCount,
    wrongCount,
    lastAnsweredAt: seenCount > 0 ? '2026-07-04T00:00:00.000Z' : null,
    bookmark: false,
    noteText: '',
    note: '',
    wrongReasonTags,
    wrongReasonUpdatedAt: wrongReasonTags.length > 0 ? '2026-07-04T00:00:00.000Z' : null,
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('prepareWeaknessAnalysisInput ignores unknown progress and invalid or duplicate questions', () => {
  const questions = [
    question(' Q-2 ', '10', { sectionTitle: ' Ten ' }),
    question('Q-1', '2'),
    question('Q-3', 'A'),
    question('Q-4', '1'),
    question('Q-duplicate', '3'),
    question('Q-duplicate', '4'),
    question('', '5'),
    question('Q-empty-section', ''),
    { id: 42, section: '6' },
    null,
  ];
  const progress = {
    'Q-1': progressEntry({ seenCount: 1, correctCount: 1 }),
    'Q-2': progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
    'Q-3': progressEntry({ seenCount: 0 }),
    UNKNOWN: progressEntry({ seenCount: 99, wrongCount: 99 }),
  };

  const input = prepareWeaknessAnalysisInput(questions, progress);

  assert.deepEqual(
    input.questionItems.map((item) => item.questionId),
    ['Q-2', 'Q-1', 'Q-3', 'Q-4', 'Q-duplicate']
  );
  assert.deepEqual(
    input.sections.map((section) => section.section),
    ['1', '2', '3', '10', 'A']
  );
  assert.equal(input.questionItems.find((item) => item.questionId === 'Q-2').sectionTitle, 'Ten');
  assert.equal(
    input.questionItems.some((item) => item.questionId === 'UNKNOWN'),
    false
  );
});

test('buildBasicWeaknessSummary aggregates overall and section counts without counting unanswered questions as answered', () => {
  const input = prepareWeaknessAnalysisInput(
    [question('Q1', '1'), question('Q2', '1'), question('Q3', '2'), question('Q4', '2')],
    {
      Q1: progressEntry({
        seenCount: 3,
        correctCount: 2,
        wrongCount: 1,
        wrongReasonTags: [conceptGap],
      }),
      Q2: progressEntry({ seenCount: 0, wrongReasonTags: [termConfusion] }),
      Q3: progressEntry({ seenCount: 2, correctCount: 0, wrongCount: 2 }),
      Q4: progressEntry({
        seenCount: 1,
        correctCount: 1,
        wrongCount: 0,
        wrongReasonTags: [specError],
      }),
    }
  );

  const summary = buildBasicWeaknessSummary(input);

  assert.deepEqual(summary.overall, {
    totalQuestionCount: 4,
    answeredQuestionCount: 3,
    totalAttemptCount: 6,
    correctCount: 3,
    wrongCount: 3,
    accuracyRate: 0.5,
    taggedQuestionCount: 3,
  });
  assert.deepEqual(
    summary.sections.map(
      ({
        section,
        totalQuestionCount,
        answeredQuestionCount,
        totalAttemptCount,
        correctCount,
        wrongCount,
        taggedQuestionCount,
      }) => ({
        section,
        totalQuestionCount,
        answeredQuestionCount,
        totalAttemptCount,
        correctCount,
        wrongCount,
        taggedQuestionCount,
      })
    ),
    [
      {
        section: '1',
        totalQuestionCount: 2,
        answeredQuestionCount: 1,
        totalAttemptCount: 3,
        correctCount: 2,
        wrongCount: 1,
        taggedQuestionCount: 2,
      },
      {
        section: '2',
        totalQuestionCount: 2,
        answeredQuestionCount: 2,
        totalAttemptCount: 3,
        correctCount: 1,
        wrongCount: 2,
        taggedQuestionCount: 1,
      },
    ]
  );
});

test('buildWeaknessAnalysis returns all seven wrong-reason tags in registry order with zero-count tags', () => {
  const result = buildWeaknessAnalysis(
    [question('Q1', '1'), question('Q2', '1'), question('Q3', '1')],
    {
      Q1: progressEntry({
        seenCount: 1,
        wrongCount: 1,
        wrongReasonTags: [careless, conceptGap, careless, 'unknown-tag'],
      }),
      Q2: progressEntry({
        seenCount: 1,
        wrongCount: 1,
        wrongReasonTags: [careless, termConfusion],
      }),
      Q3: progressEntry({ seenCount: 1, correctCount: 1 }),
    }
  );

  assert.deepEqual(
    result.tags.map((tag) => tag.id),
    tagIds
  );
  assert.deepEqual(
    result.tags.map(({ id, taggedQuestionCount }) => ({ id, taggedQuestionCount })),
    [
      { id: conceptGap, taggedQuestionCount: 1 },
      { id: termConfusion, taggedQuestionCount: 1 },
      { id: specError, taggedQuestionCount: 0 },
      { id: codeGap, taggedQuestionCount: 0 },
      { id: readingOverlook, taggedQuestionCount: 0 },
      { id: choiceUnclear, taggedQuestionCount: 0 },
      { id: careless, taggedQuestionCount: 2 },
    ]
  );
  assert.deepEqual(result.priorities.tag, {
    item: { id: careless, label: WRONG_REASON_TAGS[6].label, taggedQuestionCount: 2 },
    reasonCode: 'highest-tagged-question-count',
  });
});

test('buildWeaknessAssessment evaluates data sufficiency with defaults, valid overrides, and invalid fallbacks', () => {
  const basicSummary = {
    overall: { answeredQuestionCount: 2 },
    sections: [
      { section: '1', answeredQuestionCount: 0, wrongCount: 0 },
      { section: '2', answeredQuestionCount: 2, wrongCount: 1 },
      { section: '3', answeredQuestionCount: 3, wrongCount: 1 },
    ],
    tags: [],
  };

  assert.equal(buildWeaknessAssessment(basicSummary).criteria.minAnsweredQuestionCount, 3);
  assert.deepEqual(
    buildWeaknessAssessment(basicSummary).sections.map((section) => section.analysisStatus),
    ['unstarted', 'insufficient', 'ready']
  );
  assert.deepEqual(
    buildWeaknessAssessment(basicSummary, { minAnsweredQuestionCount: 2 }).sections.map(
      (section) => section.analysisStatus
    ),
    ['unstarted', 'ready', 'ready']
  );
  assert.equal(
    buildWeaknessAssessment(basicSummary, { minAnsweredQuestionCount: 0 }).criteria
      .minAnsweredQuestionCount,
    3
  );
});

test('buildWeaknessAnalysis selects priority section by wrong count, accuracy, attempts, then section order', () => {
  const questions = [
    question('S1-A', '1'),
    question('S1-B', '1'),
    question('S1-C', '1'),
    question('S2-A', '2'),
    question('S2-B', '2'),
    question('S2-C', '2'),
    question('S3-A', '3'),
    question('S3-B', '3'),
    question('S3-C', '3'),
    question('S4-A', '4'),
    question('S4-B', '4'),
    question('S4-C', '4'),
  ];
  const progress = {
    'S1-A': progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
    'S1-B': progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
    'S1-C': progressEntry({ seenCount: 2, correctCount: 2 }),
    'S2-A': progressEntry({ seenCount: 3, correctCount: 1, wrongCount: 2 }),
    'S2-B': progressEntry({ seenCount: 1, correctCount: 1 }),
    'S2-C': progressEntry({ seenCount: 1, correctCount: 1 }),
    'S3-A': progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
    'S3-B': progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
    'S3-C': progressEntry({ seenCount: 1, correctCount: 1 }),
    'S4-A': progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
    'S4-B': progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
    'S4-C': progressEntry({ seenCount: 1, correctCount: 1 }),
  };

  const result = buildWeaknessAnalysis(questions, progress);

  assert.equal(result.priorities.section.reasonCode, 'highest-wrong-count');
  assert.equal(result.priorities.section.item.section, '2');

  const tied = buildWeaknessAnalysis(
    questions.filter((item) => item.section !== '2'),
    progress
  );
  assert.equal(tied.priorities.section.item.section, '3');
});

test('buildWeaknessAnalysis exposes priority section no-candidate reason codes', () => {
  const questions = [question('Q1', '1'), question('Q2', '1'), question('Q3', '1')];

  assert.equal(buildWeaknessAnalysis(questions, {}).priorities.section.reasonCode, 'not-started');
  assert.equal(
    buildWeaknessAnalysis(questions, { Q1: progressEntry({ seenCount: 1, wrongCount: 1 }) })
      .priorities.section.reasonCode,
    'not-enough-data'
  );
  assert.equal(
    buildWeaknessAnalysis(questions, {
      Q1: progressEntry({ seenCount: 1, correctCount: 1 }),
      Q2: progressEntry({ seenCount: 1, correctCount: 1 }),
      Q3: progressEntry({ seenCount: 1, correctCount: 1 }),
    }).priorities.section.reasonCode,
    'no-wrong-answers'
  );
  assert.equal(
    buildWeaknessAnalysis(questions, {}).priorities.tag.reasonCode,
    'no-tagged-questions'
  );
});

test('buildWeaknessAnalysis selects priority tag by tagged question count and registry order tie-breaker', () => {
  const result = buildWeaknessAnalysis(
    [question('Q1', '1'), question('Q2', '1'), question('Q3', '1')],
    {
      Q1: progressEntry({
        seenCount: 1,
        wrongCount: 1,
        wrongReasonTags: [termConfusion, careless],
      }),
      Q2: progressEntry({ seenCount: 1, wrongCount: 1, wrongReasonTags: [termConfusion] }),
      Q3: progressEntry({ seenCount: 1, wrongCount: 1, wrongReasonTags: [careless] }),
    }
  );

  assert.deepEqual(result.priorities.tag, {
    item: { id: termConfusion, label: WRONG_REASON_TAGS[1].label, taggedQuestionCount: 2 },
    reasonCode: 'highest-tagged-question-count',
  });
});

test('buildWeaknessAnalysis reports accuracy quality states and does not repair inconsistent counts', () => {
  const result = buildWeaknessAnalysis(
    [
      question('AVAILABLE', '1'),
      question('EMPTY', '2'),
      question('INCONSISTENT', '3'),
      question('ZERO-SEEN-WITH-COUNTS', '4'),
    ],
    {
      AVAILABLE: progressEntry({ seenCount: 3, correctCount: 2, wrongCount: 1 }),
      EMPTY: progressEntry(),
      INCONSISTENT: progressEntry({ seenCount: 3, correctCount: 3, wrongCount: 1 }),
      'ZERO-SEEN-WITH-COUNTS': progressEntry({ seenCount: 0, correctCount: 1 }),
    },
    { minAnsweredQuestionCount: 1 }
  );

  assert.equal(result.sections[0].accuracyRateStatus, 'available');
  assert.equal(result.sections[0].accuracyRate, 2 / 3);
  assert.equal(result.sections[1].accuracyRateStatus, 'not-applicable');
  assert.equal(result.sections[1].accuracyRate, null);
  assert.equal(result.sections[2].accuracyRateStatus, 'inconsistent-counts');
  assert.equal(result.sections[2].accuracyRate, null);
  assert.equal(result.sections[2].totalAttemptCount, 3);
  assert.equal(result.sections[2].correctCount, 3);
  assert.equal(result.sections[2].wrongCount, 1);
  assert.equal(result.sections[3].accuracyRateStatus, 'inconsistent-counts');
  assert.equal(result.sections[3].accuracyRate, null);
  assert.equal(result.overall.accuracyRateStatus, 'inconsistent-counts');
});

test('buildWeaknessAnalysis prefers available accuracy over inconsistent accuracy when wrong counts tie', () => {
  const result = buildWeaknessAnalysis(
    [question('A1', '1'), question('A2', '1'), question('B1', '2'), question('B2', '2')],
    {
      A1: progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
      A2: progressEntry({ seenCount: 1, correctCount: 1 }),
      B1: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 1 }),
      B2: progressEntry({ seenCount: 1, correctCount: 1 }),
    },
    { minAnsweredQuestionCount: 2 }
  );

  assert.equal(result.sections[1].accuracyRateStatus, 'inconsistent-counts');
  assert.equal(result.priorities.section.item.section, '1');
  assert.equal(result.priorities.section.item.accuracyRateStatus, 'available');
});

test('buildWeaknessAnalysis does not mutate questions, progress, or options and returns final output contract', () => {
  const questions = [question('Q1', '2'), question('Q2', '1'), question('Q3', '1')];
  const progress = {
    Q1: progressEntry({ seenCount: 1, wrongCount: 1, wrongReasonTags: [careless] }),
    Q2: progressEntry({ seenCount: 1, correctCount: 1 }),
  };
  const options = { minAnsweredQuestionCount: 2 };
  const beforeQuestions = deepClone(questions);
  const beforeProgress = deepClone(progress);
  const beforeOptions = deepClone(options);

  const result = buildWeaknessAnalysis(questions, progress, options);

  assert.deepEqual(questions, beforeQuestions);
  assert.deepEqual(progress, beforeProgress);
  assert.deepEqual(options, beforeOptions);
  assert.deepEqual(Object.keys(result), ['criteria', 'overall', 'sections', 'tags', 'priorities']);
  assert.deepEqual(
    result.sections.map((section) => section.section),
    ['1', '2']
  );
  assert.deepEqual(
    result.tags.map((tag) => tag.id),
    tagIds
  );
  assert.equal(result.criteria.minAnsweredQuestionCount, 2);
});
