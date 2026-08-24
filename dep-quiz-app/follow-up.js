export const FOLLOW_UP_AVAILABILITY_REASONS = Object.freeze([
  'available',
  'no_relation',
  'source_not_graded',
  'target_not_found',
  'target_in_session',
  'already_completed',
]);
export const FOLLOW_UP_EMPHASES = Object.freeze(['recommended', 'optional']);

const ACTIVE = 'active';
const COMPLETED = 'completed';

/** Resolve a canonical relation without duplicating schema validation. */
export function resolveFollowUpTarget(source, questions) {
  const targetId = getTargetId(source);
  if (targetId === null || !Array.isArray(questions)) return null;
  return questions.find((question) => question?.id === targetId) ?? null;
}

/** Map the Phase E confidence outcome guidance to follow-up presentation. */
export function getFollowUpPresentation(confidenceOutcome) {
  return { emphasis: confidenceOutcome?.guidance === 'review' ? 'recommended' : 'optional' };
}

export function getFollowUpAvailability({
  source,
  questions,
  sourceGraded = false,
  sessionOrder = [],
  interactions = {},
  confidenceOutcome = null,
} = {}) {
  const targetId = getTargetId(source);
  const presentation = getFollowUpPresentation(confidenceOutcome);
  if (targetId === null) return unavailable('no_relation', presentation);
  if (sourceGraded !== true) return unavailable('source_not_graded', presentation);
  const target = resolveFollowUpTarget(source, questions);
  if (target === null) return unavailable('target_not_found', presentation);
  if (Array.isArray(sessionOrder) && sessionOrder.includes(target.id)) {
    return unavailable('target_in_session', presentation, target);
  }
  const normalized = normalizeFollowUpInteractions(interactions);
  if (normalized[source?.id]?.status === COMPLETED) {
    return unavailable('already_completed', presentation, target);
  }
  return { available: true, reason: 'available', target, presentation };
}

export function normalizeFollowUpInteractions(value) {
  if (!isPlainObject(value)) return {};
  const normalized = {};
  for (const [sourceId, interaction] of Object.entries(value)) {
    if (
      isNonEmptyString(sourceId) &&
      isPlainObject(interaction) &&
      (interaction.status === ACTIVE || interaction.status === COMPLETED)
    ) {
      normalized[sourceId] = { status: interaction.status };
    }
  }
  return normalized;
}

export function startFollowUp(interactions, sourceId) {
  const normalized = normalizeFollowUpInteractions(interactions);
  if (!isNonEmptyString(sourceId) || normalized[sourceId]) return normalized;
  return { ...normalized, [sourceId]: { status: ACTIVE } };
}

export function cancelFollowUp(interactions, sourceId) {
  const normalized = normalizeFollowUpInteractions(interactions);
  if (!isNonEmptyString(sourceId) || normalized[sourceId]?.status !== ACTIVE) return normalized;
  const { [sourceId]: _removed, ...remaining } = normalized;
  return remaining;
}

export function completeFollowUp(interactions, sourceId) {
  const normalized = normalizeFollowUpInteractions(interactions);
  if (!isNonEmptyString(sourceId) || normalized[sourceId]?.status !== ACTIVE) return normalized;
  return { ...normalized, [sourceId]: { status: COMPLETED } };
}

function unavailable(reason, presentation, target = null) {
  return { available: false, reason, target, presentation };
}

function getTargetId(source) {
  const targetId = source?.followUp?.questionId;
  return isNonEmptyString(targetId) ? targetId : null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
