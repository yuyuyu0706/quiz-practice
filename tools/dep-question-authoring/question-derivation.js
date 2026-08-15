import { createQuestion, createQuestionDraft } from './question-editing.js';
import { addQuestionToVariantGroup, createVariantGroup } from './variant-editing.js';

const CHOICE_KEYS = ['A', 'B', 'C', 'D'];

function findSource(questions, sourceQuestionId) {
  const source = questions.find((question) => question.id === sourceQuestionId);
  if (!source) throw new Error(`Source Question not found: ${sourceQuestionId}`);
  return source;
}

function copyChoices(question) {
  return Object.fromEntries(CHOICE_KEYS.map((key) => [key, question.choices?.[key] ?? '']));
}

export function buildCloneQuestionDraft(sourceQuestion) {
  if (!sourceQuestion) throw new Error('Source Question is required.');
  return { ...createQuestionDraft(sourceQuestion), id: '' };
}

export function buildVariantQuestionDraft(sourceQuestion) {
  if (!sourceQuestion) throw new Error('Source Question is required.');
  const draft = createQuestionDraft(sourceQuestion);
  return {
    ...draft,
    id: '',
    question: '',
    answer: '',
    explanation: '',
    whyWrong: Object.fromEntries(CHOICE_KEYS.map((key) => [key, ''])),
    notes: '',
    choices: copyChoices(sourceQuestion),
  };
}

export function createQuestionClone(questions, sourceQuestionId, draft) {
  findSource(questions, sourceQuestionId);
  return createQuestion(questions, draft);
}

function assertExactSourceChoices(source, draft) {
  for (const key of CHOICE_KEYS) {
    if (String(draft.choices?.[key] ?? '').trim() !== String(source.choices?.[key] ?? '').trim()) {
      throw new Error('Variant choices must exactly match the source Question choices.');
    }
  }
}

export function createQuestionVariant(questions, sourceQuestionId, draft, newGroupId = '') {
  const source = findSource(questions, sourceQuestionId);
  assertExactSourceChoices(source, draft);
  const created = createQuestion(questions, draft);
  const newQuestionId = String(draft.id).trim();
  const next = source.variantGroup
    ? addQuestionToVariantGroup(created, newQuestionId, source.variantGroup)
    : createVariantGroup(created, [sourceQuestionId, newQuestionId], String(newGroupId));
  // Keep the workflow defensive if relation primitives change independently.
  assertExactSourceChoices(findSource(next, sourceQuestionId), findSource(next, newQuestionId));
  return next;
}
