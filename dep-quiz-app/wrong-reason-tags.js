export const WRONG_REASON_TAGS = Object.freeze([
  Object.freeze({ id: 'concept-behavior-gap', label: '概念・挙動がイメージできない' }),
  Object.freeze({ id: 'term-feature-meaning-confusion', label: '用語・機能の意味を混同した' }),
  Object.freeze({ id: 'spec-memory-error', label: '仕様の覚え違い' }),
  Object.freeze({ id: 'code-understanding-gap', label: '実装コードが理解できない' }),
  Object.freeze({ id: 'question-reading-overlook', label: '問題文の読み落とし' }),
  Object.freeze({ id: 'choice-difference-unclear', label: '選択肢の違いが分からず迷った' }),
  Object.freeze({ id: 'careless-mistake', label: 'ケアレスミス' }),
]);

export const WRONG_REASON_TAG_IDS = Object.freeze(WRONG_REASON_TAGS.map(({ id }) => id));

const WRONG_REASON_TAG_ID_SET = new Set(WRONG_REASON_TAG_IDS);

export function normalizeWrongReasonTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];

  const accepted = new Set();
  rawTags.forEach((tag) => {
    if (typeof tag !== 'string') return;
    const normalizedTag = tag.trim();
    if (WRONG_REASON_TAG_ID_SET.has(normalizedTag)) accepted.add(normalizedTag);
  });
  return WRONG_REASON_TAG_IDS.filter((tagId) => accepted.has(tagId));
}
