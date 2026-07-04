import assert from 'node:assert/strict';

import {
  buildWeaknessAnalysis,
  buildWeaknessAssessment,
  prepareWeaknessAnalysisInput,
} from '../dep-quiz-app/analysis.js';

function question(id, section) {
  return { id, section, sectionTitle: `Section ${section}` };
}

function progress(seenCount, correctCount, wrongCount) {
  return { seenCount, correctCount, wrongCount };
}

function sectionSummary(section, overrides = {}) {
  return {
    section,
    sectionTitle: `Section ${section}`,
    answeredQuestionCount: 3,
    totalAttemptCount: 3,
    correctCount: 2,
    wrongCount: 1,
    accuracyRate: 2 / 3,
    accuracyRateStatus: 'available',
    ...overrides,
  };
}

function prioritySectionFor(sectionSummaries) {
  return buildWeaknessAssessment(
    {
      overall: { answeredQuestionCount: 3 },
      sections: sectionSummaries,
      tags: [],
    },
    { minAnsweredQuestionCount: 3 }
  ).priorities.section.item?.section;
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('誤答数が多いSectionを最優先する', () => {
  assert.equal(
    prioritySectionFor([
      sectionSummary('1', {
        wrongCount: 1,
        correctCount: 4,
        totalAttemptCount: 5,
        accuracyRate: 0.8,
      }),
      sectionSummary('2', {
        wrongCount: 3,
        correctCount: 3,
        totalAttemptCount: 6,
        accuracyRate: 0.5,
      }),
    ]),
    '2'
  );
});

test('誤答数・正答率が同値の場合、累計解答数が多いSectionを優先する', () => {
  assert.equal(
    prioritySectionFor([
      sectionSummary('1', {
        wrongCount: 2,
        correctCount: 2,
        totalAttemptCount: 4,
        accuracyRate: 0.5,
      }),
      sectionSummary('2', {
        wrongCount: 2,
        correctCount: 4,
        totalAttemptCount: 6,
        accuracyRate: 0.5,
      }),
    ]),
    '2'
  );
});

test('誤答数・正答率・累計解答数が同値の場合、既存Section順を維持する', () => {
  assert.equal(
    prioritySectionFor([
      sectionSummary('2', {
        wrongCount: 2,
        correctCount: 2,
        totalAttemptCount: 4,
        accuracyRate: 0.5,
      }),
      sectionSummary('1', {
        wrongCount: 2,
        correctCount: 2,
        totalAttemptCount: 4,
        accuracyRate: 0.5,
      }),
    ]),
    '2'
  );
});

test('minAnsweredQuestionCountの不正値は既定値3へ戻る', () => {
  [-1, 1.5, '3', null, {}].forEach((minAnsweredQuestionCount) => {
    const assessment = buildWeaknessAssessment(
      {
        overall: { answeredQuestionCount: 3 },
        sections: [sectionSummary('1')],
        tags: [],
      },
      { minAnsweredQuestionCount }
    );

    assert.equal(assessment.criteria.minAnsweredQuestionCount, 3);
    assert.equal(assessment.overall.minAnsweredQuestionCount, 3);
    assert.equal(assessment.sections[0].minAnsweredQuestionCount, 3);
  });
});

test('progress全体が非オブジェクトでも安全な集計値になる', () => {
  assert.doesNotThrow(() => prepareWeaknessAnalysisInput([question('1', '1')], 'invalid-progress'));
  assert.doesNotThrow(() => buildWeaknessAnalysis([question('1', '1')], 'invalid-progress'));

  const analysisInput = prepareWeaknessAnalysisInput([question('1', '1')], 'invalid-progress');
  assert.deepEqual(analysisInput.questionItems[0].progress, {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
    hasNote: false,
    wrongReasonTags: [],
  });

  const analysis = buildWeaknessAnalysis([question('1', '1')], 'invalid-progress');
  assert.equal(analysis.overall.answeredQuestionCount, 0);
  assert.equal(analysis.overall.totalAttemptCount, 0);
  assert.equal(analysis.overall.correctCount, 0);
  assert.equal(analysis.overall.wrongCount, 0);
});

test('問題ごとのprogressがnullでも安全な集計値になる', () => {
  assert.doesNotThrow(() => buildWeaknessAnalysis([question('1', '1')], { 1: null }));

  const analysis = buildWeaknessAnalysis([question('1', '1')], { 1: null });

  assert.equal(analysis.overall.answeredQuestionCount, 0);
  assert.equal(analysis.overall.totalAttemptCount, 0);
  assert.equal(analysis.overall.correctCount, 0);
  assert.equal(analysis.overall.wrongCount, 0);
  assert.equal(analysis.sections[0].analysisStatus, 'unstarted');
});

test('負数または文字列のseenCount/correctCount/wrongCountでも安全な集計値になる', () => {
  const malformedProgress = {
    negative: progress(-1, -2, -3),
    string: progress('seen', 'correct', 'wrong'),
  };

  assert.doesNotThrow(() =>
    buildWeaknessAnalysis([question('negative', '1'), question('string', '1')], malformedProgress)
  );

  const analysis = buildWeaknessAnalysis(
    [question('negative', '1'), question('string', '1')],
    malformedProgress
  );

  assert.equal(analysis.overall.answeredQuestionCount, 0);
  assert.equal(analysis.overall.totalAttemptCount, 0);
  assert.equal(analysis.overall.correctCount, 0);
  assert.equal(analysis.overall.wrongCount, 0);
  assert.equal(analysis.overall.accuracyRate, null);
});
