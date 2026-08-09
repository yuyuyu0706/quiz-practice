export function cloneQuestions(questions) {
  return typeof structuredClone === 'function'
    ? structuredClone(questions)
    : JSON.parse(JSON.stringify(questions));
}

function assertGroupId(groupId) {
  if (typeof groupId !== 'string' || groupId.trim() === '') {
    throw new Error('Group ID must be a non-empty string.');
  }
  if (groupId !== groupId.trim()) {
    throw new Error('Group ID must not have leading or trailing whitespace.');
  }
}

function findQuestion(questions, questionId) {
  const question = questions.find((item) => item.id === questionId);
  if (!question) throw new Error(`Question ${questionId} was not found.`);
  return question;
}

function groupExists(questions, groupId) {
  return questions.some((question) => question.variantGroup === groupId);
}

export function createVariantGroup(questions, questionIds, groupId) {
  assertGroupId(groupId);
  if (groupExists(questions, groupId)) throw new Error(`Group ${groupId} already exists.`);
  const ids = [...new Set(questionIds)];
  if (ids.length < 2) throw new Error('Select at least two questions.');
  ids.forEach((id) => {
    const question = findQuestion(questions, id);
    if (question.variantGroup != null) {
      throw new Error(`Question ${id} already belongs to group ${question.variantGroup}.`);
    }
  });
  const selected = new Set(ids);
  return questions.map((question) =>
    selected.has(question.id) ? { ...question, variantGroup: groupId } : question
  );
}

export function addQuestionToVariantGroup(questions, questionId, groupId) {
  assertGroupId(groupId);
  if (!groupExists(questions, groupId)) throw new Error(`Group ${groupId} was not found.`);
  const target = findQuestion(questions, questionId);
  if (target.variantGroup != null) {
    throw new Error(`Question ${questionId} already belongs to group ${target.variantGroup}.`);
  }
  return questions.map((question) =>
    question.id === questionId ? { ...question, variantGroup: groupId } : question
  );
}

export function removeQuestionFromVariantGroup(questions, questionId) {
  const target = findQuestion(questions, questionId);
  if (target.variantGroup == null) throw new Error(`Question ${questionId} is not grouped.`);
  return questions.map((question) => {
    if (question.id !== questionId) return question;
    const next = { ...question };
    delete next.variantGroup;
    return next;
  });
}

export function renameVariantGroup(questions, oldGroupId, newGroupId) {
  assertGroupId(newGroupId);
  if (!groupExists(questions, oldGroupId)) throw new Error(`Group ${oldGroupId} was not found.`);
  if (oldGroupId === newGroupId) throw new Error('New Group ID must differ from the current ID.');
  if (groupExists(questions, newGroupId)) throw new Error(`Group ${newGroupId} already exists.`);
  return questions.map((question) =>
    question.variantGroup === oldGroupId ? { ...question, variantGroup: newGroupId } : question
  );
}
