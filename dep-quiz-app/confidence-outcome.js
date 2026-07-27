import { isConfidenceLevel } from './confidence.js';
import { ANSWER_RESULT_IDS } from './progress.js';

export const CONFIDENCE_OUTCOMES = Object.freeze([
  Object.freeze({
    id: 'correct_high',
    result: 'correct',
    confidence: 'high',
    title: '理解が安定しています',
    meaning: '判断の根拠を持ち、自信が掴めている状態です',
    action: '必要に応じて解説を確認し、次の問題へ進みましょう',
  }),
  Object.freeze({
    id: 'correct_medium',
    result: 'correct',
    confidence: 'medium',
    title: '正解ですが、迷いが残っています',
    meaning: '確信が持てず、判断の根拠にまだ不安がある状態です',
    action: '迷った選択肢と正解の差異を深堀りましょう',
  }),
  Object.freeze({
    id: 'correct_low',
    result: 'correct',
    confidence: 'low',
    title: '油断禁物。偶然の正解かもしれません',
    meaning: '正解ですが、再現性を持って回答できない可能性がある状態です。',
    action: '解説を読み、正解の根拠を自分の言葉で説明しましょう。',
  }),
  Object.freeze({
    id: 'wrong_high',
    result: 'wrong',
    confidence: 'high',
    title: '誤認です。前提から見直しましょう',
    meaning: '誤った前提や仕様の覚え違いが定着している可能性が高い状態です',
    action: '「なぜ、間違いか？」を重点的に確認してください',
  }),
  Object.freeze({
    id: 'wrong_medium',
    result: 'wrong',
    confidence: 'medium',
    title: '理解が不安定です。問題意図と判断理由を振り返りましょう',
    meaning: '判断理由や選択肢の差異理解が不十分な可能性がある状態です',
    action: '解説と各選択肢の差異を重点的に確認してください',
  }),
  Object.freeze({
    id: 'wrong_low',
    result: 'wrong',
    confidence: 'low',
    title: '基礎から確認しましょう',
    meaning: '問題を解くための基礎概念や前提知識不足の可能性がある状態です。',
    action: '基礎概念と解説を順に見直しましょう',
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
