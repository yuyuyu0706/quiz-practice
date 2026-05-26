export function baseProgress() {
  return {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
    noteText: '',
    noteUpdatedAt: null,
  };
}

export function getQuestionNote(progress, questionId) {
  const item = progress[questionId] ?? {};
  return item.noteText ?? item.note ?? item.memo ?? '';
}

export function hasNote(progress, questionId) {
  return String(getQuestionNote(progress, questionId)).trim().length > 0;
}

export function saveNote(progress, questionId, rawNote) {
  const current = { ...baseProgress(), ...(progress[questionId] ?? {}) };
  const noteText = String(rawNote ?? '').trim();
  current.noteText = noteText;
  current.note = noteText;
  current.noteUpdatedAt = noteText ? new Date().toISOString() : null;
  return { ...progress, [questionId]: current };
}

export function deleteNote(progress, questionId) {
  return saveNote(progress, questionId, '');
}

export function deleteAllNotes(progress) {
  const next = { ...progress };
  Object.entries(next).forEach(([key, value]) => {
    next[key] = {
      ...baseProgress(),
      ...value,
      noteText: '',
      note: '',
      noteUpdatedAt: null,
    };
  });
  return next;
}

export function getAllNoteItems(questions, progress) {
  return questions
    .map((question) => {
      const item = progress[question.id] ?? {};
      const noteText = String(item.noteText ?? item.note ?? '').trim();
      if (!noteText) return null;
      return {
        id: question.id,
        section: question.section,
        questionText: question.question,
        noteText,
        noteUpdatedAt: item.noteUpdatedAt ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.noteUpdatedAt ?? 0) - new Date(a.noteUpdatedAt ?? 0));
}
