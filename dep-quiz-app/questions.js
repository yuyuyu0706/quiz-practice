export async function loadQuestions() {
  const res = await fetch('questions.json');
  if (!res.ok) throw new Error('questions.json の読み込みに失敗しました');
  return normalizeQuestions(await res.json());
}

export function normalizeQuestions(rawQuestions) {
  return Array.isArray(rawQuestions) ? rawQuestions : [];
}
export function findQuestionById(questions, questionId) {
  return questions.find((q) => q.id === questionId);
}
