import { createSession } from './quiz-session.js';

const WEAKNESS_REVIEW_MODE = 'weaknessReview';
const WEAKNESS_REVIEW_SOURCE = 'weaknessReviewTargets';

export function createWeaknessReviewSession(targetPlan) {
  assertPlainTargetPlan(targetPlan);

  const order = targetPlan.items.map((item, index) => normalizeTargetItemId(item, index));
  if (order.length === 0) {
    throw new RangeError('weakness review targetPlan must contain at least one item');
  }

  assertUniqueIds(order);

  const settingsSnapshot = {
    mode: WEAKNESS_REVIEW_MODE,
    count: order.length,
    source: WEAKNESS_REVIEW_SOURCE,
    condition: copyCondition(targetPlan.condition),
  };

  return createSession(order, WEAKNESS_REVIEW_MODE, settingsSnapshot);
}

function assertPlainTargetPlan(targetPlan) {
  if (!isPlainObject(targetPlan)) {
    throw new TypeError('targetPlan must be an object');
  }

  if (!Array.isArray(targetPlan.items)) {
    throw new TypeError('targetPlan.items must be an array');
  }

  if (!isPlainObject(targetPlan.condition)) {
    throw new TypeError('targetPlan.condition must be an object');
  }
}

function normalizeTargetItemId(item, index) {
  if (!isPlainObject(item)) {
    throw new TypeError(`targetPlan.items[${index}] must be an object`);
  }

  if (typeof item.id !== 'string' || item.id.trim().length === 0) {
    throw new TypeError(`targetPlan.items[${index}].id must be a non-empty string`);
  }

  return item.id;
}

function assertUniqueIds(order) {
  const seen = new Set();
  const duplicateId = order.find((id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });

  if (duplicateId) {
    throw new TypeError(`targetPlan.items contains duplicate id: ${duplicateId}`);
  }
}

function copyCondition(condition) {
  return {
    type: condition.type,
    value: condition.value,
    label: condition.label,
  };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
