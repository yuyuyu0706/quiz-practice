const FIXED_CHOICE_LABELS = ['A', 'B', 'C', 'D'];

export function shuffle(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createSession(order, mode, settingsSnapshot) {
  return { schemaVersion: 1, app: 'dep-quiz-app', mode, order, currentIndex: 0, answers: {}, choiceMap: {}, graded: {}, completedAt: null, explanationOpen: false, startedAt: new Date().toISOString(), settingsSnapshot };
}

export function createQuizSession(questions, settings, mode, progress, hasNoteFn) {
  let pool = questions.filter((q) => settings.sections.includes(q.section));
  if (mode === 'wrongOnly') pool = pool.filter((q) => (progress[q.id]?.wrongCount ?? 0) > 0);
  else if (mode === 'bookmarks') pool = pool.filter((q) => progress[q.id]?.bookmark);
  else if (mode === 'notesOnly') pool = pool.filter((q) => hasNoteFn(progress, q.id));
  if (mode === 'random') pool = shuffle(pool);
  const count = settings.count === 'all' ? pool.length : Number(settings.count);
  const finalList = pool.slice(0, Math.min(count, pool.length));
  return { pool, session: createSession(finalList.map((q) => q.id), mode, { ...settings, mode }) };
}

export function getChoiceLabels(choices) {
  const keys = Object.keys(choices);
  return FIXED_CHOICE_LABELS.every((l) => keys.includes(l)) ? [...FIXED_CHOICE_LABELS] : [...keys].sort();
}

export function isValidChoiceMap(map, labels, originalKeys) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
  const mapLabels = Object.keys(map);
  if (mapLabels.length !== labels.length || !labels.every((label) => mapLabels.includes(label))) return false;
  const values = Object.values(map);
  const set = new Set(values);
  return set.size === originalKeys.length && originalKeys.every((key) => set.has(key));
}

export function getOrCreateChoiceMap(session, questionId, choices) {
  const labels = getChoiceLabels(choices);
  const originalKeys = Object.keys(choices);
  const savedMap = session.choiceMap[questionId];
  if (isValidChoiceMap(savedMap, labels, originalKeys)) return savedMap;
  const shuffled = shuffle(originalKeys);
  const generated = labels.reduce((acc, label, i) => ({ ...acc, [label]: shuffled[i] }), {});
  session.choiceMap[questionId] = generated;
  return generated;
}
