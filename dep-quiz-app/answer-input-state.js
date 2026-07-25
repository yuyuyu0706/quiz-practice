import { normalizeConfidenceLevel } from './confidence.js';

export function getAnswerInputState({ hasChoice = false, confidence = null, graded = false } = {}) {
  if (graded) return Object.freeze({ id: 'graded', canSubmit: false });

  const hasValidConfidence = normalizeConfidenceLevel(confidence) !== null;
  if (!hasChoice && !hasValidConfidence) {
    return Object.freeze({ id: 'missing_both', canSubmit: false });
  }
  if (!hasChoice) return Object.freeze({ id: 'missing_choice', canSubmit: false });
  if (!hasValidConfidence) {
    return Object.freeze({ id: 'missing_confidence', canSubmit: false });
  }
  return Object.freeze({ id: 'ready', canSubmit: true });
}
