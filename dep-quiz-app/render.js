export function showView(views, name) { Object.entries(views).forEach(([key, node]) => node.classList.toggle('active', key === name)); }

export function formatDateTime(value) { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ja-JP'); }

export function getQuestionPreview(text) {
  const normalized = String(text ?? '').trim(); if (!normalized) return '';
  const periodIndex = normalized.indexOf('。'); const newlineIndex = normalized.indexOf('\n');
  const cutPoints = [periodIndex, newlineIndex].filter((index) => index >= 0);
  const sentenceEnd = cutPoints.length ? Math.min(...cutPoints) + 1 : Number.POSITIVE_INFINITY;
  const cutIndex = Math.min(sentenceEnd, 50, normalized.length);
  return `${normalized.slice(0, cutIndex)}${cutIndex < normalized.length ? '…' : ''}`;
}

export function renderNotesList(els, noteItems, handlers) {
  els.notesList.replaceChildren();
  const hasItems = noteItems.length > 0;
  els.notesEmpty.classList.toggle('hidden', hasItems);
  els.deleteAllNotes.disabled = !hasItems;
  if (!hasItems) return;
  noteItems.forEach((item) => {
    const article = document.createElement('article'); article.className = 'note-card';
    article.innerHTML = `<h3 class="note-card-title">${item.id} / Section ${item.section}</h3><p class="note-card-question">問題: ${getQuestionPreview(item.questionText)}</p><p class="note-card-body"></p><p class="note-card-updated">更新日時: ${formatDateTime(item.noteUpdatedAt)}</p>`;
    article.querySelector('.note-card-body').textContent = item.noteText;
    const actions = document.createElement('div'); actions.className = 'button-row wrap';
    const solveBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: 'この問題を解く' });
    solveBtn.addEventListener('click', () => handlers.onSolve(item.id));
    const editBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: '編集' });
    editBtn.addEventListener('click', () => handlers.onEdit(article, item.id));
    const deleteBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: '削除', className: 'danger-secondary' });
    deleteBtn.addEventListener('click', () => handlers.onDelete(item.id));
    actions.append(solveBtn, editBtn, deleteBtn); article.appendChild(actions); els.notesList.appendChild(article);
  });
}
