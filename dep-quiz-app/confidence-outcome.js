import { isConfidenceLevel } from './confidence.js';
import { ANSWER_RESULT_IDS } from './progress.js';

export const CONFIDENCE_OUTCOMES = Object.freeze([
  Object.freeze({
    id: 'correct_high',
    result: 'correct',
    confidence: 'high',
    title: '理解が安定しています',
    meaning: '根拠を持って正解できており、理解が定着している状態です。',
    action: '必要に応じて解説を確認し、次の問題へ進みましょう。',
  }),
  Object.freeze({
    id: 'correct_medium',
    result: 'correct',
    confidence: 'medium',
    title: '正解ですが、迷いが残っています',
    meaning: '正解できましたが、判断の根拠にまだ不安がある状態です。',
    action: '迷った選択肢と正解の違いを確認しましょう。',
  }),
  Object.freeze({
    id: 'correct_low',
    result: 'correct',
    confidence: 'low',
    title: '偶然正解の可能性があります',
    meaning: '正解ですが、同じ問いに再現性を持って答えられない可能性があります。',
    action: '解説を読み、正解の根拠を自分の言葉で説明しましょう。',
  }),
  Object.freeze({
    id: 'wrong_high',
    result: 'wrong',
    confidence: 'high',
    title: '思い込みを見直しましょう',
    meaning: '誤った前提や仕様の覚え違いが定着している可能性が高い状態です。',
    action: '誤っていた前提と正しい考え方の違いを重点的に見直しましょう。',
  }),
  Object.freeze({
    id: 'wrong_medium',
    result: 'wrong',
    confidence: 'medium',
    title: '判断条件を整理しましょう',
    meaning: '判断条件の理解や選択肢の比較が十分でなかった状態です。',
    action: '各選択肢を分ける条件を確認しましょう。',
  }),
  Object.freeze({
    id: 'wrong_low',
    result: 'wrong',
    confidence: 'low',
    title: '基礎から確認しましょう',
    meaning: '問題を解くための基礎概念や前提知識が不足している可能性がある状態です。',
    action: '基礎概念と解説を順に見直しましょう。',
  }),
]);

const ANSWER_RESULT_ID_SET = new Set(ANSWER_RESULT_IDS);
const OUTCOME_BY_ID = new Map(CONFIDENCE_OUTCOMES.map((outcome) => [outcome.id, outcome]));
const OUTCOME_BY_PAIR = new Map(
  CONFIDENCE_OUTCOMES.map((outcome) => [`${outcome.result}:${outcome.confidence}`, outcome])
);

export function deriveConfidenceOutcomeId(result, confidence) {
  const outcome = getConfidenceOutcome(result, confidence);
  return outcome === null ? null : outcome.id;
}

export function getConfidenceOutcome(result, confidence) {
  if (!ANSWER_RESULT_ID_SET.has(result) || !isConfidenceLevel(confidence)) return null;

  return OUTCOME_BY_PAIR.get(`${result}:${confidence}`) ?? null;
}

export function getConfidenceOutcomeById(outcomeId) {
  if (typeof outcomeId !== 'string') return null;

  return OUTCOME_BY_ID.get(outcomeId) ?? null;
}
