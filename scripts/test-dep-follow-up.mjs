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
        source: {
          sourceQuestionId: 'source',
          targetQuestionId: 'target',
          status: 'completed',
        },
      },
    }),
    'target_in_session'
  );
  assert.equal(
    reason({
      interactions: {
        source: {
          sourceQuestionId: 'source',
          targetQuestionId: 'target',
          status: 'completed',
        },
      },
    }),
    'already_completed'
  );
});

test('presentation maps review to recommended and other guidance to optional', () => {
  assert.deepEqual(getFollowUpPresentation({ guidance: 'review' }), { emphasis: 'recommended' });
  for (const value of [{ guidance: 'advance' }, { guidance: 'future' }, null]) {
    assert.deepEqual(getFollowUpPresentation(value), { emphasis: 'optional' });
  }
});

test('lifecycle supports idle, active, cancel, and completed idempotently', () => {
  const active = startFollowUp({}, 'source', 'target');
  assert.deepEqual(active, {
    source: { sourceQuestionId: 'source', targetQuestionId: 'target', status: 'active' },
  });
  assert.deepEqual(startFollowUp(active, 'source', 'other-target'), active);
  assert.deepEqual(startFollowUp({}, 'source'), {});
  assert.deepEqual(cancelFollowUp(active, 'source'), {});
  const completed = completeFollowUp(active, 'source');
  assert.deepEqual(completed, {
    source: { sourceQuestionId: 'source', targetQuestionId: 'target', status: 'completed' },
  });
  assert.deepEqual(startFollowUp(completed, 'source', 'target'), completed);
  assert.deepEqual(cancelFollowUp(completed, 'source'), completed);
  assert.deepEqual(completeFollowUp({}, 'source'), {});
});

test('different sources remain independent', () => {
  const both = startFollowUp(startFollowUp({}, 'source-a', 'target'), 'source-b', 'target');
  assert.deepEqual(completeFollowUp(both, 'source-a'), {
    'source-a': { sourceQuestionId: 'source-a', targetQuestionId: 'target', status: 'completed' },
    'source-b': { sourceQuestionId: 'source-b', targetQuestionId: 'target', status: 'active' },
  });
});

test('normalizer removes malformed state and canonicalizes valid entries', () => {
  assert.deepEqual(
    normalizeFollowUpInteractions({
      active: {
        sourceQuestionId: 'active',
        targetQuestionId: 'target-a',
        status: 'active',
        extra: true,
      },
      completed: {
        sourceQuestionId: 'completed',
        targetQuestionId: 'target-b',
        status: 'completed',
      },
      idle: { sourceQuestionId: 'idle', targetQuestionId: 'target', status: 'idle' },
      array: [],
      missing: {},
      missingTarget: { sourceQuestionId: 'missingTarget', status: 'active' },
      mismatchedSource: {
        sourceQuestionId: 'other',
        targetQuestionId: 'target',
        status: 'active',
      },
      '': { status: 'active' },
    }),
    {
      active: { sourceQuestionId: 'active', targetQuestionId: 'target-a', status: 'active' },
      completed: {
        sourceQuestionId: 'completed',
        targetQuestionId: 'target-b',
        status: 'completed',
      },
    }
  );
  for (const value of [null, [], 'bad', 3]) {
    assert.deepEqual(normalizeFollowUpInteractions(value), {});
  }
});

test('all operations preserve caller-owned inputs', () => {
  const sessionOrder = ['source'];
  const interactions = {
    source: {
      sourceQuestionId: 'source',
      targetQuestionId: 'target',
      status: 'active',
      extra: true,
    },
  };
  const snapshot = structuredClone({ questions, source, sessionOrder, interactions });
  getFollowUpAvailability({ source, questions, sourceGraded: true, sessionOrder, interactions });
  normalizeFollowUpInteractions(interactions);
  completeFollowUp(interactions, 'source');
  assert.deepEqual({ questions, source, sessionOrder, interactions }, snapshot);
});
