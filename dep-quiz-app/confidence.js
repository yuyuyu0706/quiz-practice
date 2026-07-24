export const CONFIDENCE_LEVELS = Object.freeze([
  Object.freeze({
    id: 'high',
    label: '確信あり',
    description: '根拠を持って正しいと判断している',
  }),
  Object.freeze({
    id: 'medium',
    label: '迷いあり',
    description: '候補は絞れたが、判断に迷いがある',
  }),
  Object.freeze({
    id: 'low',
    label: '自信なし',
    description: '勘に近い、または十分な根拠を持てない',
  }),
]);

const CONFIDENCE_LEVEL_IDS = new Set(CONFIDENCE_LEVELS.map((level) => level.id));

export function isConfidenceLevel(value) {
  return typeof value === 'string' && CONFIDENCE_LEVEL_IDS.has(value);
}

export function normalizeConfidenceLevel(value) {
  return isConfidenceLevel(value) ? value : null;
}

export function assertConfidenceLevel(value) {
  if (!isConfidenceLevel(value)) {
    throw new TypeError('Invalid confidence level');
  }

  return value;
}
