const LEGACY_QUESTION_ID_PATTERN = /^Q(\d+)$/;
const DEA_PLUS_QUESTION_ID_PATTERN = /^DEA-PLUS-Q\d{3}$/;

export function normalizeQuestionId(questionId) {
  if (typeof questionId !== 'string') return questionId;

  const match = LEGACY_QUESTION_ID_PATTERN.exec(questionId.trim());
  if (!match) return questionId;

  return `DEA-PLUS-Q${match[1].padStart(3, '0')}`;
}

export function isLegacyQuestionId(questionId) {
  return typeof questionId === 'string' && LEGACY_QUESTION_ID_PATTERN.test(questionId.trim());
}

export function isDeaPlusQuestionId(questionId) {
  return typeof questionId === 'string' && DEA_PLUS_QUESTION_ID_PATTERN.test(questionId);
}
