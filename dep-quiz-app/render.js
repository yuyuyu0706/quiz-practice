export function showView(views, name) {
  Object.entries(views).forEach(([key, node]) => node.classList.toggle('active', key === name));
}

export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ja-JP');
}

export function getQuestionPreview(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return '';

  const periodIndex = normalized.indexOf('。');
  const newlineIndex = normalized.indexOf('\n');
  const cutPoints = [periodIndex, newlineIndex].filter((index) => index >= 0);
  const sentenceEnd = cutPoints.length ? Math.min(...cutPoints) + 1 : Number.POSITIVE_INFINITY;
  const cutIndex = Math.min(sentenceEnd, 50, normalized.length);

  return `${normalized.slice(0, cutIndex)}${cutIndex < normalized.length ? '…' : ''}`;
}

function appendInlineFormattedText(element, text) {
  const inlinePattern = /(\*\*(.+?)\*\*)|(`([^`\n]+)`)/g;
  const source = String(text ?? '');
  let currentIndex = 0;
  let match = inlinePattern.exec(source);

  while (match) {
    if (match.index > currentIndex) {
      element.appendChild(document.createTextNode(source.slice(currentIndex, match.index)));
    }

    if (match[2] !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = match[2];
      element.appendChild(strong);
    } else if (match[4] !== undefined) {
      const code = document.createElement('code');
      code.className = 'inline-code';
      code.textContent = match[4];
      element.appendChild(code);
    }

    currentIndex = inlinePattern.lastIndex;
    match = inlinePattern.exec(source);
  }

  if (currentIndex < source.length) {
    element.appendChild(document.createTextNode(source.slice(currentIndex)));
  }
}

function appendInlineFormattedTextWithLineBreaks(element, text) {
  String(text)
    .split('\n')
    .forEach((line, index, arr) => {
      appendInlineFormattedText(element, line);
      if (index < arr.length - 1) {
        element.appendChild(document.createElement('br'));
      }
    });
}

function appendFormattedTextWithCodeBlocks(element, text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n');
  const segments = normalized.split(/(```[\s\S]*?```)/g).filter(Boolean);

  segments.forEach((segment) => {
    const codeMatch = segment.match(/^```\s*([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n?```$/);
    if (codeMatch) {
      const language = (codeMatch[1] ?? '').toLowerCase();
      const pre = document.createElement('pre');
      pre.className = `code-block${language ? ` lang-${language}` : ''}`;

      const code = document.createElement('code');
      if (language) code.className = `language-${language}`;
      code.textContent = codeMatch[2];

      pre.appendChild(code);
      element.appendChild(pre);
      return;
    }

    appendInlineFormattedTextWithLineBreaks(element, segment);
  });
}

function renderMarkdownToFragment(markdownText) {
  const fragment = document.createDocumentFragment();
  if (!markdownText.trim()) {
    const empty = document.createElement('p');
    empty.textContent = '解説はまだ登録されていません。';
    fragment.appendChild(empty);
    return fragment;
  }

  const lines = markdownText.replace(/\r\n/g, '\n').split('\n');
  const paragraphBuffer = [];
  const listBuffer = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const p = document.createElement('p');
    appendInlineFormattedText(p, paragraphBuffer.join('\n').trim());
    fragment.appendChild(p);
    paragraphBuffer.length = 0;
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    const ul = document.createElement('ul');
    listBuffer.forEach((text) => {
      const li = document.createElement('li');
      appendInlineFormattedText(li, text);
      ul.appendChild(li);
    });
    fragment.appendChild(ul);
    listBuffer.length = 0;
  };

  const flushCode = () => {
    const pre = document.createElement('pre');
    pre.className = `code-block${codeLanguage ? ` lang-${codeLanguage}` : ''}`;
    const code = document.createElement('code');
    if (codeLanguage) code.className = `language-${codeLanguage}`;
    code.textContent = codeBuffer.join('\n');
    pre.appendChild(code);
    fragment.appendChild(pre);
    codeBuffer = [];
    codeLanguage = '';
  };

  lines.forEach((line) => {
    const fence = line.match(/^```\s*([a-zA-Z0-9_-]+)?\s*$/);
    if (fence) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeLanguage = (fence[1] ?? '').toLowerCase();
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem) {
      flushParagraph();
      listBuffer.push(listItem[1].trim());
      return;
    }

    flushList();
    paragraphBuffer.push(line);
  });

  if (inCodeBlock) flushCode();
  flushParagraph();
  flushList();
  return fragment;
}

function getWhyWrongEntries(whyWrong, choiceMap = {}) {
  if (!whyWrong || typeof whyWrong !== 'object' || Array.isArray(whyWrong)) return [];

  const originalToDisplayed = Object.entries(choiceMap || {}).reduce(
    (acc, [displayed, original]) => {
      acc[String(original)] = String(displayed);
      return acc;
    },
    {}
  );

  const entries = Object.entries(whyWrong)
    .map(([label, value]) => ({
      label: String(originalToDisplayed[String(label)] ?? label).trim(),
      reason: typeof value === 'string' ? value.trim() : '',
    }))
    .filter((item) => item.label && item.reason);

  const order = new Map(['A', 'B', 'C', 'D'].map((label, index) => [label, index]));
  return entries.sort((a, b) => (order.get(a.label) ?? 99) - (order.get(b.label) ?? 99));
}

export function renderQuestion(els, data) {
  const {
    question,
    idx,
    total,
    choiceLabels,
    choiceMap,
    chosen,
    graded,
    explanationOpen,
    bookmarkEnabled,
  } = data;

  els.quizSection.textContent = `Section ${question.section}: ${question.sectionTitle}`;
  els.quizProgress.textContent = `${idx} / ${total}`;
  els.quizQuestion.replaceChildren();

  const questionId = document.createElement('span');
  questionId.className = 'quiz-question-id';
  questionId.textContent = question.id;
  els.quizQuestion.append(questionId, document.createElement('br'));
  appendFormattedTextWithCodeBlocks(els.quizQuestion, question.question);

  els.resultIndicator.textContent = '';
  els.resultIndicator.className = 'indicator';
  els.quizMessage.textContent = '';
  els.choicesForm.classList.remove('needs-selection');
  els.choicesForm.replaceChildren();

  choiceLabels.forEach((label) => {
    const choiceLabel = document.createElement('label');
    choiceLabel.dataset.choice = label;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'choice';
    input.value = label;
    input.checked = chosen === label;
    choiceLabel.appendChild(input);

    const text = question.choices[choiceMap[label]];
    appendFormattedTextWithCodeBlocks(choiceLabel, ` ${label}. ${text}`);
    els.choicesForm.appendChild(choiceLabel);
  });

  renderExplanation(els, { question, choiceMap });
  els.explanation.classList.toggle('hidden', !explanationOpen);
  els.toggleExplanation.textContent = explanationOpen ? '解説を非表示' : '解説を表示';

  if (graded) {
    const correctLabel = choiceLabels.find((label) => choiceMap[label] === question.answer);
    const correct = chosen === correctLabel;

    els.resultIndicator.textContent = correct
      ? `✅ 正解（正答: ${correctLabel}）`
      : `❌ 不正解（正答: ${correctLabel}）`;
    els.resultIndicator.classList.add(correct ? 'ok' : 'ng');

    els.choicesForm.querySelectorAll('label').forEach((labelEl) => {
      const labelKey = labelEl.dataset.choice;
      if (labelKey === correctLabel) labelEl.classList.add('correct');
      if (labelKey === chosen && labelKey !== correctLabel) labelEl.classList.add('wrong');
    });
  }

  els.bookmarkBtn.textContent = bookmarkEnabled ? 'ブックマーク★' : 'ブックマーク☆';
}

export function renderExplanation(els, { question, choiceMap }) {
  els.explanation.replaceChildren();
  els.explanation.appendChild(
    renderMarkdownToFragment(typeof question.explanation === 'string' ? question.explanation : '')
  );

  const whyWrongEntries = getWhyWrongEntries(question.whyWrong, choiceMap);
  if (!whyWrongEntries.length) return;

  const section = document.createElement('section');
  section.className = 'why-wrong';

  const title = document.createElement('h3');
  title.textContent = 'なぜ、間違いか？';
  section.appendChild(title);

  const list = document.createElement('ul');
  whyWrongEntries.forEach(({ label, reason }) => {
    const li = document.createElement('li');
    const key = document.createElement('strong');
    key.textContent = `${label}: `;
    li.appendChild(key);
    appendInlineFormattedText(li, reason);
    list.appendChild(li);
  });

  section.appendChild(list);
  els.explanation.appendChild(section);
}

export function renderResult(els, result) {
  els.scoreText.textContent = `スコア: ${result.correctCount} / ${result.total}（${result.rate}%）`;

  const sectionText = Object.entries(result.sectionStats)
    .map(([sec, stat]) => `S${sec}: ${Math.round((stat.ok / stat.total) * 100)}%`)
    .join(' / ');
  els.sectionScoreText.textContent = `セクション別: ${sectionText}`;

  els.wrongList.replaceChildren();
  if (!result.wrongItems.length) {
    const li = document.createElement('li');
    li.textContent = '全問正解です！';
    els.wrongList.appendChild(li);
    return;
  }

  result.wrongItems.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    els.wrongList.appendChild(li);
  });
}

export function renderNotesList(els, noteItems, handlers) {
  els.notesList.replaceChildren();
  const hasItems = noteItems.length > 0;
  els.notesEmpty.classList.toggle('hidden', hasItems);
  els.deleteAllNotes.disabled = !hasItems;
  if (!hasItems) return;

  noteItems.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'note-card';

    const title = document.createElement('h3');
    title.className = 'note-card-title';
    title.textContent = `${item.id} / Section ${item.section}`;

    const question = document.createElement('p');
    question.className = 'note-card-question';
    question.textContent = `問題: ${getQuestionPreview(item.questionText)}`;

    const body = document.createElement('p');
    body.className = 'note-card-body';
    body.textContent = item.noteText;

    const updated = document.createElement('p');
    updated.className = 'note-card-updated';
    updated.textContent = `更新日時: ${formatDateTime(item.noteUpdatedAt)}`;

    const actions = document.createElement('div');
    actions.className = 'button-row wrap';

    const solveBtn = Object.assign(document.createElement('button'), {
      type: 'button',
      textContent: 'この問題を解く',
    });
    solveBtn.addEventListener('click', () => handlers.onSolve(item.id));

    const editBtn = Object.assign(document.createElement('button'), {
      type: 'button',
      textContent: '編集',
    });
    editBtn.addEventListener('click', () => handlers.onEdit(article, item.id));

    const deleteBtn = Object.assign(document.createElement('button'), {
      type: 'button',
      textContent: '削除',
      className: 'danger-secondary',
    });
    deleteBtn.addEventListener('click', () => handlers.onDelete(item.id));

    actions.append(solveBtn, editBtn, deleteBtn);
    article.append(title, question, body, updated, actions);
    els.notesList.appendChild(article);
  });
}

export function toggleNoteEditor(card, noteText, onSave) {
  const existingEditor = card.querySelector('.note-editor');
  if (existingEditor) {
    existingEditor.remove();
    return;
  }

  const editor = document.createElement('div');
  editor.className = 'note-editor';

  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.value = noteText;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = '保存';
  saveBtn.className = 'primary';
  saveBtn.addEventListener('click', () => onSave(textarea.value));

  editor.append(textarea, saveBtn);
  card.appendChild(editor);
}
