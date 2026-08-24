import assert from 'node:assert/strict';
import {
  cancelFollowUp,
  completeFollowUp,
  getFollowUpAvailability,
  getFollowUpPresentation,
  normalizeFollowUpInteractions,
  resolveFollowUpTarget,
  startFollowUp,
} from '../dep-quiz-app/follow-up.js';

function test(name, fn) {
  fn();
  console.log(`✓ ${name}`);
}
const target = { id: 'target', question: 'Deep dive' };
const source = { id: 'source', followUp: { questionId: target.id } };
const questions = [source, target];

test('resolver safely resolves, or returns null for absent and unresolved relations', () => {
  assert.strictEqual(resolveFollowUpTarget(source, questions), target);
  assert.equal(resolveFollowUpTarget({}, questions), null);
  assert.equal(resolveFollowUpTarget(source, []), null);
  assert.equal(resolveFollowUpTarget(null, null), null);
});

test('availability uses stable reasons in contract priority order', () => {
  assert.deepEqual(
    getFollowUpAvailability({ source, questions, sourceGraded: true, sessionOrder: ['source'] }),
    { available: true, reason: 'available', target, presentation: { emphasis: 'optional' } }
  );
  const reason = (overrides) =>
    getFollowUpAvailability({ source, questions, sourceGraded: true, ...overrides }).reason;
  assert.equal(reason({ source: {} }), 'no_relation');
  assert.equal(reason({ sourceGraded: false, questions: [] }), 'source_not_graded');
  assert.equal(reason({ questions: [] }), 'target_not_found');
  assert.equal(
    reason({
      sessionOrder: ['target'],
      interactions: {
        source: { status: 'completed' },
      },
    }),
    'target_in_session'
  );
  assert.equal(reason({ interactions: { source: { status: 'completed' } } }), 'already_completed');
});

test('presentation maps review to recommended and other guidance to optional', () => {
  assert.deepEqual(getFollowUpPresentation({ guidance: 'review' }), { emphasis: 'recommended' });
  for (const value of [{ guidance: 'advance' }, { guidance: 'future' }, null]) {
    assert.deepEqual(getFollowUpPresentation(value), { emphasis: 'optional' });
  }
});

test('lifecycle supports idle, active, cancel, and completed idempotently', () => {
  const active = startFollowUp({}, 'source');
  assert.deepEqual(active, { source: { status: 'active' } });
  assert.deepEqual(startFollowUp(active, 'source'), active);
  assert.deepEqual(cancelFollowUp(active, 'source'), {});
  const completed = completeFollowUp(active, 'source');
  assert.deepEqual(completed, { source: { status: 'completed' } });
  assert.deepEqual(startFollowUp(completed, 'source'), completed);
  assert.deepEqual(cancelFollowUp(completed, 'source'), completed);
  assert.deepEqual(completeFollowUp({}, 'source'), {});
});

test('different sources remain independent', () => {
  const both = startFollowUp(startFollowUp({}, 'source-a'), 'source-b');
  assert.deepEqual(completeFollowUp(both, 'source-a'), {
    'source-a': { status: 'completed' },
    'source-b': { status: 'active' },
  });
});

test('normalizer removes malformed state and canonicalizes valid entries', () => {
  assert.deepEqual(
    normalizeFollowUpInteractions({
      active: { status: 'active', extra: true },
      completed: { status: 'completed' },
      idle: { status: 'idle' },
      array: [],
      missing: {},
      '': { status: 'active' },
    }),
    { active: { status: 'active' }, completed: { status: 'completed' } }
  );
  for (const value of [null, [], 'bad', 3]) {
    assert.deepEqual(normalizeFollowUpInteractions(value), {});
  }
});

test('all operations preserve caller-owned inputs', () => {
  const sessionOrder = ['source'];
  const interactions = { source: { status: 'active', extra: true } };
  const snapshot = structuredClone({ questions, source, sessionOrder, interactions });
  getFollowUpAvailability({ source, questions, sourceGraded: true, sessionOrder, interactions });
  normalizeFollowUpInteractions(interactions);
  completeFollowUp(interactions, 'source');
  assert.deepEqual({ questions, source, sessionOrder, interactions }, snapshot);
});
