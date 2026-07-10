const STORAGE_KEY_LABELS = {
  depQuizProgress: '学習進捗データ',
  depQuizSettings: '設定データ',
  depQuizActiveSession: '前回セッションデータ',
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

export function renderAnalysisSummary(container, analysis) {
  if (!container) return;

  container.replaceChildren();

  const result = analysis && typeof analysis === 'object' ? analysis : {};
  container.appendChild(
    createSummarySection(result.overall, '学習全体サマリ', 'analysis-summary-title')
  );
  container.appendChild(createFocusSummary(result.overall, result.priorities));
  container.appendChild(createTagSummary(result.tags, result.overall));
  container.appendChild(createSectionSummaries(result.sections));
}

export function renderWeaknessReviewTargetPanel(panel, targetPlan) {
  if (!panel) return;

  panel.replaceChildren();

  if (!targetPlan || typeof targetPlan !== 'object') {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;

  const title = document.createElement('h3');
  title.id = 'weakness-review-targets-panel-title';
  title.textContent = '復習対象の問題';

  const condition = document.createElement('p');
  condition.className = 'weakness-review-targets-panel__condition';
  condition.textContent = `条件: ${formatTargetConditionLabel(targetPlan.condition)}`;

  const count = document.createElement('p');
  count.className = 'weakness-review-targets-panel__count';
  count.textContent = `対象件数: ${formatSummaryCount(targetPlan.targetCount)}問`;

  panel.append(title, condition, count);

  if (targetPlan.emptyState) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'weakness-review-targets-panel__empty';
    emptyMessage.textContent = 'この条件に該当する問題はありません。';
    panel.appendChild(emptyMessage);
    return;
  }

  const list = document.createElement('div');
  list.className = 'weakness-review-targets-list';

  const items = Array.isArray(targetPlan.items) ? targetPlan.items : [];
  items.forEach((item) => list.appendChild(createWeaknessReviewTargetItem(item)));

  panel.appendChild(list);
}

function createWeaknessReviewTargetItem(itemSource) {
  const item = itemSource && typeof itemSource === 'object' ? itemSource : {};
  const article = document.createElement('article');
  article.className = 'weakness-review-target-item';

  const heading = document.createElement('h4');
  heading.className = 'weakness-review-target-item__title';
  heading.textContent = formatTargetQuestionTitle(item);

  const question = document.createElement('p');
  question.className = 'weakness-review-target-item__question';
  question.textContent = getQuestionPreview(item.questionText) || '問題文を表示できません。';

  const meta = document.createElement('dl');
  meta.className = 'weakness-review-target-item__meta';
  meta.append(
    createTargetMetaItem('学習状態', formatTargetStatus(item.status)),
    createTargetMetaItem('解答回数', `${formatSummaryCount(item.seenCount)}回`),
    createTargetMetaItem('正答数', formatSummaryCount(item.correctCount)),
    createTargetMetaItem('誤答数', formatSummaryCount(item.wrongCount))
  );

  const badges = document.createElement('div');
  badges.className = 'weakness-review-target-item__badges';
  appendTargetBadge(badges, item.hasWrongReasonTags, '誤答理由あり');
  appendTargetBadge(badges, item.hasNote, 'メモあり');
  appendTargetBadge(badges, item.bookmarked, 'ブックマークあり');

  article.append(heading, question, meta);
  if (badges.childElementCount > 0) {
    article.appendChild(badges);
  }

  return article;
}

function createTargetMetaItem(labelText, valueText) {
  const item = document.createElement('div');
  item.className = 'weakness-review-target-item__meta-item';

  const label = document.createElement('dt');
  label.textContent = labelText;

  const value = document.createElement('dd');
  value.textContent = valueText;

  item.append(label, value);
  return item;
}

function appendTargetBadge(container, enabled, label) {
  if (!enabled) return;

  const badge = document.createElement('span');
  badge.className = 'weakness-review-target-item__badge';
  badge.textContent = label;
  container.appendChild(badge);
}

function formatTargetQuestionTitle(item) {
  const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : '問題ID未設定';
  const section = formatSectionNumber(item.section);
  const sectionTitle = typeof item.sectionTitle === 'string' ? item.sectionTitle.trim() : '';
  const sectionLabel = section ? `Section ${section}` : 'Section';
  return sectionTitle ? `${id} / ${sectionLabel}：${sectionTitle}` : `${id} / ${sectionLabel}`;
}

function formatTargetConditionLabel(conditionSource) {
  const condition = conditionSource && typeof conditionSource === 'object' ? conditionSource : {};
  if (typeof condition.label === 'string' && condition.label.trim()) {
    return condition.label.trim();
  }

  return '条件未指定';
}

function formatTargetStatus(status) {
  const labels = {
    unseen: '未学習',
    answered: '回答済み',
    correct: '正答あり',
    wrong: '誤答あり',
  };
  return labels[status] ?? '状態未設定';
}

function createAnalysisDisclosure(titleId, titleText) {
  const details = document.createElement('details');
  details.className = 'analysis-disclosure';
  details.setAttribute('aria-labelledby', titleId);

  const summary = document.createElement('summary');
  summary.className = 'analysis-disclosure__summary';

  const title = document.createElement('span');
  title.id = titleId;
  title.className = 'analysis-disclosure__title';
  title.setAttribute('role', 'heading');
  title.setAttribute('aria-level', '3');
  title.textContent = titleText;

  summary.appendChild(title);

  const content = document.createElement('div');
  content.className = 'analysis-disclosure__content';

  details.append(summary, content);
  return details;
}

function createAccuracyFootnote(summary) {
  const note = document.createElement('p');
  note.className = 'analysis-accuracy-footnote';
  note.textContent = `※ 正答率は${getAccuracyRateNote(summary?.accuracyRateStatus)}`;
  return note;
}

function createFocusSummary(overallSource, prioritiesSource) {
  const overall = overallSource && typeof overallSource === 'object' ? overallSource : {};
  const priorities =
    prioritiesSource && typeof prioritiesSource === 'object' ? prioritiesSource : {};

  const section = createAnalysisDisclosure('analysis-focus-title', '重点ポイント');
  section.classList.add('analysis-focus-summary');
  const content = section.querySelector('.analysis-disclosure__content');

  const message = document.createElement('p');
  message.className = 'analysis-focus-summary__message';

  content.appendChild(message);

  if (overall.analysisStatus === 'unstarted') {
    message.textContent = '回答履歴がないため、優先して見直すSectionや誤答理由はまだ判定しません。';
    return section;
  }

  if (overall.analysisStatus === 'insufficient') {
    message.textContent =
      '回答済み問題数が少ないため、重点対象はまだ表示しません。もう少し回答すると傾向を確認できます。';
    return section;
  }

  message.textContent =
    '分析結果から、次に見直す候補を表示しています。表示中の数値は既存の分析結果に基づきます。';

  const list = document.createElement('div');
  list.className = 'analysis-focus-list';
  list.append(createPrioritySectionCard(priorities.section), createPriorityTagCard(priorities.tag));
  content.appendChild(list);
  return section;
}

function createPrioritySectionCard(prioritySource) {
  const priority = prioritySource && typeof prioritySource === 'object' ? prioritySource : {};
  const item = priority.item && typeof priority.item === 'object' ? priority.item : null;

  if (priority.reasonCode === 'highest-wrong-count' && item) {
    return createFocusCard({
      title: '優先して見直すSection',
      target: getSectionSummaryTitle(item),
      metrics: [
        { label: '回答済み問題数', value: formatSummaryCount(item.answeredQuestionCount) },
        { label: '累計解答数', value: formatSummaryCount(item.totalAttemptCount) },
        { label: '誤答数', value: formatSummaryCount(item.wrongCount) },
        {
          label: '正答率 ※',
          value: formatAccuracyRate(item),
          accuracyRateStatus: item.accuracyRateStatus,
        },
      ],
      reason: '分析可能なSectionの中で、誤答数が最も多い領域です。',
    });
  }

  if (priority.reasonCode === 'not-enough-data') {
    return createFocusCard({
      title: '優先して見直すSection',
      target: '重点Sectionはまだ表示しません',
      metrics: [],
      reason: 'Sectionごとの回答済み問題数が少ないため、重点Sectionはまだ表示しません。',
    });
  }

  if (priority.reasonCode === 'not-started') {
    return createFocusCard({
      title: '優先して見直すSection',
      target: '重点Sectionはまだ表示しません',
      metrics: [],
      reason: 'Sectionごとの回答履歴がないため、重点Sectionはまだ表示しません。',
    });
  }

  if (priority.reasonCode === 'no-wrong-answers') {
    return createFocusCard({
      title: '優先して見直すSection',
      target: '優先Sectionはありません',
      metrics: [],
      reason: '分析可能な範囲に誤答がないため、重点Sectionは表示していません。',
    });
  }

  return createFocusCard({
    title: '優先して見直すSection',
    target: '重点Sectionを準備できません',
    metrics: [],
    reason: '分析結果の状態を確認できないため、Section候補を安全に表示していません。',
  });
}

function createPriorityTagCard(prioritySource) {
  const priority = prioritySource && typeof prioritySource === 'object' ? prioritySource : {};
  const item = priority.item && typeof priority.item === 'object' ? priority.item : null;

  if (priority.reasonCode === 'highest-tagged-question-count' && item) {
    return createFocusCard({
      title: '最も多く記録された誤答理由',
      target: typeof item.label === 'string' ? item.label : '',
      metrics: [
        { label: '理由タグ問題数', value: `${formatSummaryCount(item.taggedQuestionCount)}問` },
      ],
      reason: '記録済みの理由の中で、最も多いパターンです。',
    });
  }

  if (priority.reasonCode === 'no-tagged-questions') {
    return createFocusCard({
      title: '最も多く記録された誤答理由',
      target: '重点タグはありません',
      metrics: [],
      reason: '誤答理由タグがまだ記録されていないため、重点タグは表示していません。',
    });
  }

  return createFocusCard({
    title: '最も多く記録された誤答理由',
    target: '重点タグを準備できません',
    metrics: [],
    reason: '分析結果の状態を確認できないため、タグ候補を安全に表示していません。',
  });
}

function createFocusCard({ title, target, metrics, reason }) {
  const card = document.createElement('article');
  card.className = 'analysis-focus-card';

  const heading = document.createElement('h4');
  heading.textContent = title;

  const targetElement = document.createElement('p');
  targetElement.className = 'analysis-focus-card__target';
  targetElement.textContent = target;

  const metricsList = document.createElement('dl');
  metricsList.className = 'analysis-focus-metrics';
  metrics.forEach((metric) => metricsList.appendChild(createAnalysisMetric(metric)));

  const reasonElement = document.createElement('p');
  reasonElement.className = 'analysis-focus-card__reason';
  reasonElement.textContent = reason;

  card.append(heading, targetElement, metricsList);
  if (metrics.some((metric) => isAccuracyMetric(metric))) {
    card.appendChild(createAccuracyFootnote(metrics.find((metric) => isAccuracyMetric(metric))));
  }
  card.appendChild(reasonElement);
  return card;
}

function createTagSummary(tagsSource, overallSource) {
  const tags = Array.isArray(tagsSource) ? tagsSource : [];
  const overall = overallSource && typeof overallSource === 'object' ? overallSource : {};
  const hasTaggedQuestions =
    Number.isFinite(overall.taggedQuestionCount) && overall.taggedQuestionCount > 0;

  const section = createAnalysisDisclosure('analysis-tags-title', '誤答理由タグ別サマリ');
  section.classList.add('analysis-tag-summary');
  const content = section.querySelector('.analysis-disclosure__content');

  const message = document.createElement('p');
  message.className = 'analysis-tag-summary__message';
  message.textContent = hasTaggedQuestions
    ? '誤答した問題で記録した理由を、タグ別に集計しています。'
    : '誤答理由はまだ記録されていません。誤答した問題で理由を記録すると、ここに傾向を表示します。';

  const list = document.createElement('dl');
  list.className = 'analysis-tag-list';
  tags.forEach((tag) => list.appendChild(createTagSummaryItem(tag)));

  const note = document.createElement('p');
  note.className = 'analysis-tag-summary__note';
  note.textContent =
    '1問に複数の理由を記録できるため、タグ別件数の合計は理由タグ問題数と一致しない場合があります。';

  content.append(message, list, note);
  return section;
}

function createTagSummaryItem(tagSource) {
  const tag = tagSource && typeof tagSource === 'object' ? tagSource : {};
  const item = document.createElement('div');
  item.className = 'analysis-tag-item';

  const label = document.createElement('dt');
  label.className = 'analysis-tag-item__label';
  label.textContent = typeof tag.label === 'string' ? tag.label : '';

  const count = document.createElement('dd');
  count.className = 'analysis-tag-item__count';
  count.textContent = `${formatSummaryCount(tag.taggedQuestionCount)}問`;

  const action = createReviewTargetButton({
    label: 'この理由の問題を見る',
    type: 'wrongReasonTag',
    valueName: 'tag',
    value: typeof tag.id === 'string' ? tag.id : '',
  });

  item.append(label, count, action);
  return item;
}

function createSummarySection(summarySource, titleText, titleId, options = {}) {
  const summary = summarySource && typeof summarySource === 'object' ? summarySource : {};
  const section = document.createElement('section');
  section.className = 'analysis-summary';
  section.setAttribute('aria-labelledby', titleId);

  const title = document.createElement('h3');
  title.id = titleId;

  if (options.sectionHeading) {
    title.className = 'analysis-section-card__heading';
    title.setAttribute('aria-label', titleText);

    const pin = document.createElement('span');
    pin.className = 'analysis-section-card__pin';
    pin.setAttribute('aria-hidden', 'true');
    pin.textContent = options.sectionHeading.pinLabel;

    const name = document.createElement('span');
    name.className = 'analysis-section-card__name';
    name.setAttribute('aria-hidden', 'true');
    name.textContent = options.sectionHeading.name;

    title.append(pin, name);
  } else {
    title.textContent = titleText;
  }

  const statusMessage = document.createElement('p');
  statusMessage.className = `analysis-status analysis-status--${summary.analysisStatus ?? 'unknown'}`;
  statusMessage.textContent = getAnalysisStatusMessage(summary);

  const metrics = document.createElement('dl');
  metrics.className = 'analysis-metrics';
  createAnalysisMetrics(summary).forEach((metric) =>
    metrics.appendChild(createAnalysisMetric(metric))
  );

  section.append(title, statusMessage, metrics, createAccuracyFootnote(summary));

  if (options.reviewTargetSection) {
    section.appendChild(
      createReviewTargetButton({
        label: 'このSectionの問題を見る',
        type: 'section',
        valueName: 'section',
        value: options.reviewTargetSection,
      })
    );
  }

  return section;
}

function createSectionSummaries(sectionsSource) {
  const wrapper = createAnalysisDisclosure('analysis-sections-title', 'Section別サマリ');
  wrapper.classList.add('analysis-sections');
  const content = wrapper.querySelector('.analysis-disclosure__content');

  const list = document.createElement('div');
  list.className = 'analysis-section-list';

  const sections = Array.isArray(sectionsSource) ? sectionsSource : [];
  sections.forEach((sectionSummary, index) => {
    const headingId = `analysis-section-${index + 1}-title`;
    const card = createSummarySection(
      sectionSummary,
      getSectionSummaryTitle(sectionSummary),
      headingId,
      {
        sectionHeading: getSectionHeadingParts(sectionSummary),
        reviewTargetSection: formatSectionNumber(sectionSummary?.section),
      }
    );
    card.classList.add('analysis-section-card');
    list.appendChild(card);
  });

  content.appendChild(list);
  return wrapper;
}

function createReviewTargetButton({ label, type, valueName, value }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'analysis-review-target-button';
  button.dataset.reviewTargetType = type;
  button.dataset[`reviewTarget${capitalizeDatasetKey(valueName)}`] = value;
  button.textContent = label;
  return button;
}

function capitalizeDatasetKey(value) {
  const text = typeof value === 'string' ? value : '';
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

function createAnalysisMetrics(summary) {
  return [
    {
      label: '回答済み問題数',
      value: `${formatSummaryCount(summary.answeredQuestionCount)} / ${formatSummaryCount(
        summary.totalQuestionCount
      )}`,
    },
    { label: '累計解答数', value: formatSummaryCount(summary.totalAttemptCount) },
    { label: '正答数', value: formatSummaryCount(summary.correctCount) },
    { label: '誤答数', value: formatSummaryCount(summary.wrongCount) },
    {
      label: '正答率 ※',
      value: formatAccuracyRate(summary),
      accuracyRateStatus: summary.accuracyRateStatus,
    },
    { label: '理由タグ問題数', value: formatSummaryCount(summary.taggedQuestionCount) },
  ];
}

function isAccuracyMetric(metric) {
  return metric?.label === '正答率 ※';
}

function getSectionHeadingParts(summary) {
  const sectionNumber = formatSectionNumber(summary?.section);
  const title = typeof summary?.sectionTitle === 'string' ? summary.sectionTitle.trim() : '';
  return {
    pinLabel: sectionNumber ? `Section ${sectionNumber}` : 'Section',
    name: title || 'Section',
  };
}

function getSectionSummaryTitle(summary) {
  const sectionNumber = formatSectionNumber(summary?.section);
  const title = typeof summary?.sectionTitle === 'string' ? summary.sectionTitle.trim() : '';
  const sectionLabel = sectionNumber ? `Section ${sectionNumber}` : 'Section';
  return title ? `${sectionLabel}：${title}` : sectionLabel;
}

function formatSectionNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function createAnalysisMetric({ label, value }) {
  const item = document.createElement('div');
  item.className = 'analysis-metric';

  const term = document.createElement('dt');
  term.className = 'analysis-metric__label';
  term.textContent = label;

  const description = document.createElement('dd');
  description.className = 'analysis-metric__value';
  description.textContent = value;

  item.append(term, description);

  return item;
}

function formatSummaryCount(value) {
  return Number.isFinite(value) ? String(value) : '0';
}

function formatAccuracyRate(summary) {
  if (summary.accuracyRateStatus !== 'available' || !Number.isFinite(summary.accuracyRate)) {
    return '未算出';
  }

  return `${Math.round(summary.accuracyRate * 100)}%`;
}

function getAccuracyRateNote(status) {
  if (status === 'available') return '累計解答数ベースで算出しています。';
  if (status === 'inconsistent-counts') return '記録の不整合により率を判定できません。';
  return 'まだ解答がないため算出していません。';
}

function getAnalysisStatusMessage(summary) {
  if (summary.analysisStatus === 'ready') {
    return '回答履歴を基に学習状況を集計しています。';
  }

  if (summary.analysisStatus === 'insufficient') {
    return `回答済み問題数が少ないため、傾向は参考値です。分析には${formatSummaryCount(
      summary.minAnsweredQuestionCount
    )}問以上の回答済み問題が目安です。`;
  }

  return '回答履歴がまだないため、まず問題に回答してください。弱点判定や正答率の表示は行いません。';
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

export function renderLearningHistoryResetSummary(container, plan) {
  if (!container) return;

  const impact = plan?.impact ?? {};
  const shouldClearActiveSession = Boolean(plan?.activeSession?.shouldClear);
  const resetQuestionCount = formatSummaryCount(impact.resetQuestionCount);
  const retainedNoteCount = formatSummaryCount(impact.retainedNoteCount);
  const retainedBookmarkCount = formatSummaryCount(impact.retainedBookmarkCount);

  container.replaceChildren();

  const hasResetTargets = Number(impact.resetQuestionCount) > 0;
  const lead = document.createElement('p');
  lead.className = 'learning-history-reset-summary__lead';
  if (hasResetTargets) {
    lead.textContent = `${resetQuestionCount}問の学習履歴がリセット対象です。保持されるデータもあわせて確認できます。`;
  } else if (shouldClearActiveSession) {
    lead.textContent =
      'リセット対象の学習履歴はありませんが、リセットを確定すると中断データは削除されます。';
  } else {
    lead.textContent = 'リセット対象の学習履歴はありません。';
  }
  container.appendChild(lead);

  const cards = document.createElement('div');
  cards.className = 'learning-history-reset-cards';
  cards.append(
    createLearningHistoryResetCard('リセット対象問題', `${resetQuestionCount}問`),
    createLearningHistoryResetCard('保持するメモ', `${retainedNoteCount}件`),
    createLearningHistoryResetCard('保持するブックマーク', `${retainedBookmarkCount}件`),
    createLearningHistoryResetCard(
      '中断セッション',
      shouldClearActiveSession ? '削除予定' : '影響なし'
    )
  );
  container.appendChild(cards);

  if (shouldClearActiveSession) {
    const notice = document.createElement('div');
    notice.className = 'learning-history-reset-session-note';
    notice.textContent =
      '現在の中断セッションがあります。後続の確認画面でリセットを確定した場合、この中断データは破棄されます。';
    container.appendChild(notice);
  }

  const details = document.createElement('div');
  details.className = 'learning-history-reset-details';
  details.append(
    createLearningHistoryResetList('消去対象', [
      '正解・不正解の履歴',
      '最終回答日時',
      '誤答理由タグ',
    ]),
    createLearningHistoryResetList('保持対象', ['自分用メモ', 'ブックマーク', '学習設定'])
  );
  container.appendChild(details);
}

function createLearningHistoryResetCard(label, value) {
  const card = document.createElement('article');
  card.className = 'learning-history-reset-card';

  const labelElement = document.createElement('p');
  labelElement.className = 'learning-history-reset-card__label';
  labelElement.textContent = label;

  const valueElement = document.createElement('p');
  valueElement.className = 'learning-history-reset-card__value';
  valueElement.textContent = value;

  card.append(labelElement, valueElement);
  return card;
}

function createLearningHistoryResetList(titleText, items) {
  const section = document.createElement('section');
  section.className = 'learning-history-reset-detail';

  const title = document.createElement('h3');
  title.textContent = titleText;

  const list = document.createElement('ul');
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });

  section.append(title, list);
  return section;
}
