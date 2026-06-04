const STORAGE_KEY_LABELS = {
  deaPlusQuizProgress: '学習進捗データ',
  deaPlusQuizSettings: '設定データ',
  deaPlusQuizActiveSession: '前回セッションデータ',
};

export function renderStorageRepairNotice(homeView, repairedKeys) {
  if (!homeView || !repairedKeys?.length) return;

  homeView.querySelector('.storage-repair-notice')?.remove();

  const uniqueKeys = [...new Set(repairedKeys)];
  const notice = document.createElement('div');
  notice.className = 'storage-repair-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const content = document.createElement('div');
  content.className = 'storage-repair-notice__content';

  const message = document.createElement('p');
  message.className = 'storage-repair-notice__message';
  message.textContent = '保存データの一部が破損していたため、自動修復しました。';

  const target = document.createElement('p');
  target.className = 'storage-repair-notice__target';
  target.textContent = `対象: ${uniqueKeys.map(formatStorageRepairTarget).join('、')}`;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'storage-repair-notice__close';
  closeButton.setAttribute('aria-label', '保存データ修復通知を閉じる');
  closeButton.textContent = '閉じる';
  closeButton.addEventListener('click', () => notice.remove());

  content.append(message, target);
  notice.append(content, closeButton);
  homeView.prepend(notice);
}

function formatStorageRepairTarget(key) {
  const label = STORAGE_KEY_LABELS[key] ?? '保存データ';
  return `${label}（${key}）`;
}

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
