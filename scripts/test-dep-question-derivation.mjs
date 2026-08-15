import assert from 'node:assert/strict';
import {
  buildCloneQuestionDraft,
  buildVariantQuestionDraft,
  createQuestionClone,
  createQuestionVariant,
} from '../tools/dep-question-authoring/question-derivation.js';

const choices = { A: 'Alpha', B: 'Beta', C: 'Gamma!', D: 'Delta value' };
const base = {
  id: 'Q1',
  section: '1',
  sectionTitle: 'old',
  domain: 'domain',
  tags: ['tag'],
  difficulty: 'medium',
  sourceType: 'original',
  scenarioType: 'single-step',
  estimatedTimeSec: 30,
  question: 'Source?',
  choices,
  answer: 'A',
  explanation: 'Source explanation',
  whyWrong: { B: 'No' },
  references: [{ title: 'Docs', url: 'https://example.com' }],
  notes: 'note',
  followUp: { questionId: 'FOLLOW' },
  unknown: { hidden: true },
};

const cloneDraft = buildCloneQuestionDraft(base);
assert.equal(cloneDraft.id, '');
assert.equal(cloneDraft.question, 'Source?');
assert.deepEqual(cloneDraft.references, base.references);
assert.equal(cloneDraft.variantGroup, undefined);
assert.equal(cloneDraft.followUp, undefined);
assert.equal(cloneDraft.unknown, undefined);
cloneDraft.id = 'Q2';
const cloned = createQuestionClone([base], 'Q1', cloneDraft);
assert.equal(cloned[1].variantGroup, undefined);
assert.equal(cloned[1].followUp, undefined);
assert.deepEqual(base.followUp, { questionId: 'FOLLOW' });

const variantDraft = buildVariantQuestionDraft(base);
assert.deepEqual(variantDraft.choices, choices);
assert.equal(variantDraft.id, '');
assert.equal(variantDraft.question, '');
assert.equal(variantDraft.answer, '');
assert.equal(variantDraft.explanation, '');
assert.equal(variantDraft.notes, '');
Object.assign(variantDraft, {
  id: 'Q3',
  question: 'Different perspective?',
  answer: 'B',
  explanation: 'New explanation',
});
const ungroupedVariant = createQuestionVariant([base], 'Q1', variantDraft, 'new-group');
assert.equal(ungroupedVariant[0].variantGroup, 'new-group');
assert.equal(ungroupedVariant[1].variantGroup, 'new-group');
assert.deepEqual(ungroupedVariant[0].followUp, { questionId: 'FOLLOW' });
assert.equal(ungroupedVariant[1].followUp, undefined);
assert.equal(base.variantGroup, undefined);

const grouped = [
  { ...base, variantGroup: 'existing-group' },
  { ...base, id: 'Q0', variantGroup: 'existing-group' },
];
variantDraft.id = 'Q4';
const groupedVariant = createQuestionVariant(grouped, 'Q1', variantDraft);
assert.equal(groupedVariant[2].variantGroup, 'existing-group');
assert.equal(groupedVariant[0].variantGroup, 'existing-group');
assert.equal(grouped.length, 2);

for (const changed of ['alpha', 'Alpha.', 'Alpha  value']) {
  const tampered = structuredClone(variantDraft);
  tampered.id = `BAD-${changed}`;
  tampered.choices.A = changed;
  assert.throws(() => createQuestionVariant([base], 'Q1', tampered, 'bad-group'), /exactly match/);
}
assert.throws(() => createQuestionVariant([base], 'missing', variantDraft), /not found/);
assert.throws(() => createQuestionVariant([base], 'Q1', variantDraft, ''), /non-empty/);
assert.deepEqual(base.choices, choices);

console.log('DEP question derivation tests passed.');
