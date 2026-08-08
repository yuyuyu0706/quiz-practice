import { normalizeProgressEntry } from './progress.js';

/**
 * Collapses already-eligible questions to at most one candidate per variant group.
 *
 * The first occurrence of a group reserves its output slot. Its representative is
 * the member with the lowest normalized question-level seen count; ties retain
 * input order. Questions without a variant group remain independent candidates.
 */
export function selectVariantCandidates(eligibleQuestions, progress) {
  const candidates = [];
  const groups = new Map();

  eligibleQuestions.forEach((question) => {
    const group = question.variantGroup;
    if (typeof group !== 'string') {
      candidates.push(question);
      return;
    }

    const seenCount = normalizeProgressEntry(progress?.[question.id]).seenCount;
    const current = groups.get(group);

    if (current === undefined) {
      groups.set(group, { outputIndex: candidates.length, seenCount });
      candidates.push(question);
      return;
    }

    if (seenCount < current.seenCount) {
      candidates[current.outputIndex] = question;
      current.seenCount = seenCount;
    }
  });

  return candidates;
}
