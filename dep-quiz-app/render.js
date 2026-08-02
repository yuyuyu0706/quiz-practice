const STORAGE_KEY_LABELS = {
  depQuizProgress: '学習進捗データ',
  depQuizConfidenceHistory: '回答試行履歴',
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

export function renderConfidenceHistoryCompatibilityNotice(homeView, version) {
  if (!homeView) return;
  const notice = document.createElement('div');
  notice.className = 'storage-repair-notice confidence-history-compatibility-notice';
  notice.setAttribute('role', 'alert');
  const content = document.createElement('div');
  content.className = 'storage-repair-notice__content';
  const message = document.createElement('p');
  message.className = 'storage-repair-notice__message';
  message.textContent = `回答試行履歴（Version ${version}）はこのアプリでは読み込めません。データ保護のため回答保存を停止しています。`;
  const guidance = document.createElement('p');
  guidance.className = 'storage-repair-notice__target';
  guidance.textContent = '最新版を利用するか、確認のうえ学習履歴をリセットしてください。';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'storage-repair-notice__close';
  close.textContent = '閉じる';
  close.setAttribute('aria-label', '回答試行履歴の互換性通知を閉じる');
  close.addEventListener('click', () => notice.remove());
  content.append(message, guidance);
  notice.append(content, close);
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
    confidenceLevels,
    confidence,
    confidenceOutcome,
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
  els.confidenceFieldset.classList.remove('needs-selection');
  els.choicesForm.replaceChildren();

  choiceLabels.forEach((label) => {
    const choiceLabel = document.createElement('label');
    choiceLabel.dataset.choice = label;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'choice';
    input.value = label;
    input.checked = chosen === label;
    input.disabled = Boolean(graded);
    choiceLabel.appendChild(input);

    const text = question.choices[choiceMap[label]];
    appendFormattedTextWithCodeBlocks(choiceLabel, ` ${label}. ${text}`);
    els.choicesForm.appendChild(choiceLabel);
  });

  els.confidenceOptions.replaceChildren();
  confidenceLevels.forEach((level) => {
    const option = document.createElement('label');
    option.className = 'confidence-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'confidence';
    input.value = level.id;
    input.setAttribute('aria-keyshortcuts', level.id.charAt(0).toUpperCase());
    input.setAttribute('aria-describedby', 'confidence-detail');
    input.checked = confidence === level.id;
    input.disabled = Boolean(graded);
    const copy = document.createElement('span');
    copy.className = 'confidence-option__copy';
    const title = document.createElement('strong');
    title.textContent = level.label;
    const separator = document.createElement('span');
    separator.className = 'confidence-option__separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '/';
    const levelName = document.createElement('span');
    levelName.className = 'confidence-option__level';
    levelName.textContent = `${level.id.charAt(0).toUpperCase()}${level.id.slice(1)}`;
    copy.append(title, separator, levelName);
    option.append(input, copy);
    els.confidenceOptions.appendChild(option);
  });
  updateConfidenceDetail(
    els.confidenceDetail,
    confidenceLevels.find(({ id }) => id === confidence),
    Boolean(graded)
  );

  renderExplanation(els, { question, choiceMap });
  renderConfidenceOutcome(els, confidenceOutcome);
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

export function renderConfidenceOutcome(els, outcome) {
  els.confidenceOutcomeTitle.textContent = '';
  els.confidenceOutcomeMeaning.textContent = '';
  els.confidenceOutcomeAction.textContent = '';
  els.confidenceOutcome.classList.add('hidden');
  els.confidenceOutcome.classList.remove(
    'confidence-outcome--correct',
    'confidence-outcome--wrong'
  );
  delete els.confidenceOutcome.dataset.outcome;
  delete els.confidenceOutcome.dataset.guidance;
  els.confidenceOutcomeMeaningToggle.setAttribute('aria-expanded', 'false');
  els.confidenceOutcomeActionToggle.setAttribute('aria-expanded', 'false');
  els.confidenceOutcomeMeaningPanel.hidden = true;
  els.confidenceOutcomeActionPanel.hidden = true;
  els.confidenceOutcomeWhyWrong.classList.add('hidden');

  if (!outcome) return;

  els.confidenceOutcomeTitle.textContent = outcome.title;
  els.confidenceOutcomeMeaning.textContent = outcome.meaning;
  els.confidenceOutcomeAction.textContent = outcome.action;
  els.confidenceOutcome.dataset.outcome = outcome.id;
  els.confidenceOutcome.dataset.guidance = outcome.guidance;
  els.confidenceOutcome.classList.add(`confidence-outcome--${outcome.result}`);
  els.confidenceOutcomeWhyWrong.classList.toggle(
    'hidden',
    outcome.id !== 'wrong_high' || !els.explanation.querySelector('#why-wrong')
  );
  els.confidenceOutcome.classList.remove('hidden');
}

export function updateConfidenceDetail(detail, level, graded) {
  if (!detail) return;

  detail.classList.toggle('confidence-detail--selected', Boolean(level));
  detail.hidden = !level;
  detail.dataset.state = !level ? 'unselected' : graded ? 'graded' : 'selected';
  detail.replaceChildren();
  if (!level) return;

  const label = document.createElement('strong');
  label.textContent = level.label;
  detail.append(label, document.createTextNode(` : ${level.description}`));
}

export function renderExplanation(els, { question, choiceMap }) {
  els.explanation.replaceChildren();
  els.explanation.appendChild(
    renderMarkdownToFragment(typeof question.explanation === 'string' ? question.explanation : '')
  );

  const whyWrongEntries = getWhyWrongEntries(question.whyWrong, choiceMap);
  if (!whyWrongEntries.length) return;

  const section = document.createElement('section');
  section.id = 'why-wrong';
  section.className = 'why-wrong';
  section.tabIndex = -1;
  section.setAttribute('aria-labelledby', 'why-wrong-title');

  const title = document.createElement('h3');
  title.id = 'why-wrong-title';
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

export function renderAnalysisSummary(
  container,
  analysis,
  confidenceAnalysis,
  historyOptions = {}
) {
  if (!container) return;

  container.replaceChildren();

  const result = analysis && typeof analysis === 'object' ? analysis : {};
  container.appendChild(
    createSummarySection(result.overall, '学習全体サマリ', 'analysis-summary-title')
  );
  container.appendChild(createConfidenceAnalysisSummary(confidenceAnalysis));
  container.appendChild(createConfidenceHistorySummary(historyOptions));
  container.appendChild(createFocusSummary(result.overall, result.priorities));
  container.appendChild(createTagSummary(result.tags, result.overall));
  container.appendChild(createSectionSummaries(result.sections));
}

function createConfidenceAnalysisSummary(source) {
  const analysis = source && typeof source === 'object' ? source : {};
  const coverage =
    analysis.coverage && typeof analysis.coverage === 'object' ? analysis.coverage : {};
  const review = analysis.review && typeof analysis.review === 'object' ? analysis.review : {};
  const section = createAnalysisDisclosure('analysis-confidence-title', '確信度から見る理解状態');
  section.classList.add('analysis-confidence-summary');
  const content = section.querySelector('.analysis-disclosure__content');
  const description = document.createElement('p');
  description.className = 'analysis-confidence-summary__description';
  description.textContent =
    '各問題の最新評価を1件ずつ使った分析です。学習全体サマリの累計解答数ベース正答率とは集計方法が異なります。';
  const status = document.createElement('p');
  status.className = 'analysis-confidence-status';
  status.dataset.coverageStatus = coverage.status ?? 'none';
  status.textContent = getConfidenceCoverageMessage(coverage);
  content.append(description, status);

  if (coverage.qualityStatus === 'invalid-data-excluded') {
    const quality = document.createElement('p');
    quality.className = 'analysis-confidence-quality';
    quality.dataset.qualityStatus = 'invalid-data-excluded';
    quality.textContent = `判定できない保存データ ${formatSummaryCount(coverage.invalidLatestAnswerCount)}件を分析から除外しました。`;
    content.appendChild(quality);
  }

  content.appendChild(createConfidenceCoverageMetrics(coverage, review));

  content.appendChild(
    createReviewTargetButton({
      label: '要確認の問題を見る',
      targetType: 'confidenceGuidance',
      targetValueName: 'reviewTargetGuidance',
      targetValue: 'review',
      disabled: !Number(review.reviewQuestionCount),
    })
  );

  const levelsTitle = document.createElement('h4');
  levelsTitle.textContent = '確信度別サマリ';
  const levels = document.createElement('div');
  levels.className = 'analysis-confidence-levels';
  for (const level of Array.isArray(analysis.confidenceLevels) ? analysis.confidenceLevels : []) {
    levels.appendChild(createConfidenceLevel(level));
  }
  content.append(levelsTitle, levels);

  const outcomesTitle = document.createElement('h4');
  outcomesTitle.textContent = '正誤×確信度の6分類';
  const outcomes = createConfidenceOutcomeMatrix(analysis.outcomes, review.highlightedOutcomes);
  content.append(outcomesTitle, outcomes);

  const footnote = document.createElement('p');
  footnote.className = 'analysis-confidence-summary__footnote';
  footnote.textContent = '最新評価ベース正答率の分母は、その確信度で判定できた問題数です。';
  content.appendChild(footnote);
  return section;
}

const HISTORY_PERIODS = [
  ['7d', '直近7日'],
  ['30d', '直近30日'],
  ['90d', '直近90日'],
  ['all', '全期間'],
];

const HISTORY_CHANGE_LABELS = {
  'misconception-corrected': '誤った自信を修正',
  'unstable-correctness-stabilized': '不安定な正解が安定',
  'review-to-advance': '要確認から安定理解へ',
};

function createConfidenceHistorySummary(options) {
  const section = createAnalysisDisclosure('analysis-confidence-history-title', '確信度の学習履歴');
  section.classList.add('analysis-confidence-history');
  const content = section.querySelector('.analysis-disclosure__content');
  const description = document.createElement('p');
  description.className = 'analysis-confidence-history__description';
  description.textContent =
    '選択した期間内の回答試行と、同じ問題を繰り返し解いたときの変化を分析します。上の「確信度から見る理解状態」は各問題の最新評価を1件ずつ使うため、この履歴分析とは件数・正答率の分母が異なります。';
  content.appendChild(description);

  if (options.historyStatus === 'unsupported') {
    const notice = document.createElement('p');
    notice.className = 'analysis-confidence-history__notice';
    notice.dataset.historyStatus = 'unsupported';
    const version = options.unsupportedVersion;
    notice.textContent = `回答試行履歴のVersion${version == null ? '' : ` ${version}`}はこのアプリでは非対応のため分析できません。ホームの互換性通知から学習履歴リセットをご確認ください。`;
    content.appendChild(notice);
    return section;
  }

  const body = document.createElement('div');
  body.className = 'analysis-confidence-history__body';
  const controls = createHistoryControls(options.historyAnalysis);
  const results = document.createElement('div');
  results.className = 'analysis-confidence-history__results';
  renderHistoryResults(
    results,
    options.historyAnalysis,
    options.questions,
    options.removedAttemptCount
  );
  const status = document.createElement('p');
  status.className = 'analysis-confidence-history__update-status visually-hidden';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  body.append(controls, results, status);
  content.appendChild(body);

  controls.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const period = controls.querySelector('[data-history-period]').value;
    const sectionValue = controls.querySelector('[data-history-section]').value;
    options.onHistoryQueryChange?.(
      { period, sectionId: sectionValue === '' ? null : sectionValue },
      (nextAnalysis) => {
        renderHistoryResults(results, nextAnalysis, options.questions, options.removedAttemptCount);
        syncHistorySectionOptions(controls.querySelector('[data-history-section]'), nextAnalysis);
        status.textContent = '確信度の学習履歴を更新しました。';
      }
    );
  });
  return section;
}

function createHistoryControls(analysis) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'analysis-confidence-history__filters';
  const legend = document.createElement('legend');
  legend.textContent = '履歴の表示条件';
  const period = createHistorySelect('期間', 'history-period');
  for (const [value, label] of HISTORY_PERIODS) period.select.add(new Option(label, value));
  period.select.value = analysis?.query?.period ?? '30d';
  const section = createHistorySelect('Section', 'history-section');
  syncHistorySectionOptions(section.select, analysis);
  fieldset.append(legend, period.wrapper, section.wrapper);
  return fieldset;
}

function createHistorySelect(labelText, dataName) {
  const wrapper = document.createElement('label');
  wrapper.className = 'analysis-confidence-history__filter';
  const label = document.createElement('span');
  label.textContent = labelText;
  const select = document.createElement('select');
  select.dataset[dataName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = 'true';
  wrapper.append(label, select);
  return { wrapper, select };
}

function syncHistorySectionOptions(select, analysis) {
  const value = analysis?.query?.sectionId ?? '';
  select.replaceChildren(new Option('全Section', ''));
  const sections = Array.isArray(analysis?.sections) ? analysis.sections : [];
  for (const item of sections) {
    select.add(new Option(`Section ${item.id}（${item.attemptCount}件）`, item.id));
  }
  if (value && !sections.some(({ id }) => id === value)) {
    select.add(new Option(`Section ${value}（0件）`, value));
  }
  select.value = value;
}

function renderHistoryResults(container, analysisSource, questionsSource, removedAttemptCount = 0) {
  container.replaceChildren();
  const analysis = analysisSource && typeof analysisSource === 'object' ? analysisSource : {};
  const coverage = analysis.coverage ?? {};
  const summary = analysis.summary ?? {};
  const guidance = analysis.guidance ?? {};
  const trends = analysis.trends ?? {};
  const status = document.createElement('p');
  status.className = 'analysis-confidence-history__coverage';
  status.dataset.historyCoverage = coverage.status ?? 'none';
  status.textContent =
    coverage.status === 'available'
      ? `${formatSummaryCount(coverage.filteredAttemptCount)}件の回答試行を分析しています。`
      : '選択した条件に該当する回答試行はまだありません。率は未算出です。';
  container.appendChild(status);
  if (removedAttemptCount > 0) {
    const repairNotice = document.createElement('p');
    repairNotice.className = 'analysis-confidence-history__notice';
    repairNotice.dataset.historyQuality = 'repaired';
    repairNotice.textContent = `不正または重複した回答試行${removedAttemptCount}件を修復時に除外しました。`;
    container.appendChild(repairNotice);
  }
  appendHistoryNotices(container, analysis);

  container.appendChild(
    createHistoryMetricGroup('回答試行ベース集計', [
      ['回答試行数', `${formatSummaryCount(summary.attemptCount)}件`],
      ['対象問題数', `${formatSummaryCount(summary.uniqueQuestionCount)}問`],
      ['正解数', `${formatSummaryCount(summary.correctCount)}件`],
      ['不正解数', `${formatSummaryCount(summary.wrongCount)}件`],
      ['試行ベース正答率', formatHistoryRate(summary.accuracyRate)],
      [
        '安定理解（Advance）',
        `${formatSummaryCount(guidance.advanceAttemptCount)}件・${formatHistoryRate(guidance.advanceRatio)}`,
      ],
      [
        '要確認（Review）',
        `${formatSummaryCount(guidance.reviewAttemptCount)}件・${formatHistoryRate(guidance.reviewRatio)}`,
      ],
    ])
  );

  container.appendChild(
    createHistoryCards('確信度別集計', analysis.confidenceLevels, (level) => ({
      id: level.id,
      title: level.label,
      text: `${formatSummaryCount(level.attemptCount)}件（正解${formatSummaryCount(level.correctCount)}件・不正解${formatSummaryCount(level.wrongCount)}件）／試行ベース正答率 ${formatHistoryRate(level.accuracyRate)}`,
    }))
  );
  container.appendChild(
    createHistoryCards('正誤×確信度の6分類', analysis.outcomes, (outcome) => ({
      id: outcome.id,
      title: outcome.title,
      text: `${formatSummaryCount(outcome.attemptCount)}件・${formatHistoryRate(outcome.ratio)}／${outcome.guidance === 'advance' ? '安定理解' : '要確認'}`,
    }))
  );

  container.appendChild(
    createHistoryMetricGroup('学習推移', [
      ['分析対象問題数', `${formatSummaryCount(trends.analyzedQuestionCount)}問`],
      ['遷移数', `${formatSummaryCount(trends.transitionCount)}件`],
      ['変化があった問題数', `${formatSummaryCount(trends.changedQuestionCount)}問`],
      ['誤った自信を修正', `${formatSummaryCount(trends.misconceptionCorrectedCount)}件`],
      ['不安定な正解が安定', `${formatSummaryCount(trends.unstableCorrectnessStabilizedCount)}件`],
      ['要確認から安定理解へ', `${formatSummaryCount(trends.reviewToAdvanceCount)}件`],
      ['継続Review問題', `${formatSummaryCount(trends.continuedReviewQuestionCount)}問`],
    ])
  );
  container.appendChild(createHistoryEventList(analysis.changeEvents, questionsSource));
  container.appendChild(createContinuedReviewList(analysis.questionTrends, questionsSource));
}

function appendHistoryNotices(container, analysis) {
  const { coverage = {}, quality = {}, retention = {} } = analysis;
  const notices = [];
  if (coverage.qualityStatus === 'invalid-data-excluded') {
    notices.push(
      `不正試行${quality.invalidAttemptCount ?? 0}件、重複${quality.duplicateAttemptCount ?? 0}件、保持上限による除外${quality.trimmedAttemptCount ?? 0}件を分析から除外しました。`
    );
  }
  if (coverage.futureAttemptCount)
    notices.push(`未来日時の試行${coverage.futureAttemptCount}件を除外しました。`);
  if (coverage.excludedByPeriodCount)
    notices.push(`期間外${coverage.excludedByPeriodCount}件を除外しました。`);
  if (coverage.excludedBySectionCount)
    notices.push(`Section外${coverage.excludedBySectionCount}件を除外しました。`);
  if (retention.status === 'capacity-reached')
    notices.push(
      `保持上限${retention.maxAttemptCount}件に到達しています。「全期間」は保存済みの最新${retention.maxAttemptCount}件の範囲です。`
    );
  for (const text of notices) {
    const notice = document.createElement('p');
    notice.className = 'analysis-confidence-history__notice';
    notice.textContent = text;
    container.appendChild(notice);
  }
}

function createHistoryMetricGroup(titleText, values) {
  const section = document.createElement('section');
  const title = document.createElement('h4');
  title.textContent = titleText;
  const list = document.createElement('dl');
  list.className = 'analysis-confidence-history__metrics';
  for (const [labelText, value] of values) {
    const item = document.createElement('div');
    const label = document.createElement('dt');
    label.textContent = labelText;
    const data = document.createElement('dd');
    data.textContent = value;
    item.append(label, data);
    list.appendChild(item);
  }
  section.append(title, list);
  return section;
}

function createHistoryCards(titleText, source, toCard) {
  const section = document.createElement('section');
  const title = document.createElement('h4');
  title.textContent = titleText;
  const list = document.createElement('div');
  list.className = 'analysis-confidence-history__cards';
  for (const sourceItem of Array.isArray(source) ? source : []) {
    const item = toCard(sourceItem);
    const card = document.createElement('article');
    card.dataset.historyItem = item.id;
    const heading = document.createElement('h5');
    heading.textContent = item.title;
    const detail = document.createElement('p');
    detail.textContent = item.text;
    card.append(heading, detail);
    list.appendChild(card);
  }
  section.append(title, list);
  return section;
}

function createHistoryEventList(source, questions) {
  const events = [...(Array.isArray(source) ? source : [])]
    .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)))
    .slice(0, 20);
  return createHistoryListSection('変化イベント', events, source?.length ?? 0, (event) => {
    const item = createHistoryQuestionItem(event, questions, event.changedAt);
    const state = document.createElement('p');
    state.textContent = `${event.fromOutcomeId} → ${event.toOutcomeId}`;
    const badges = document.createElement('div');
    badges.className = 'analysis-confidence-history__badges';
    for (const type of event.changeTypes ?? []) {
      const badge = document.createElement('span');
      badge.textContent = HISTORY_CHANGE_LABELS[type] ?? type;
      badges.appendChild(badge);
    }
    item.append(state, badges);
    return item;
  });
}

function createContinuedReviewList(source, questions) {
  const items = [...(Array.isArray(source) ? source : [])]
    .filter((item) => item.latestGuidance === 'review' && item.reviewStreakCount >= 2)
    .sort((a, b) => String(b.latestAnsweredAt).localeCompare(String(a.latestAnsweredAt)))
    .slice(0, 20);
  const total = (Array.isArray(source) ? source : []).filter(
    (item) => item.latestGuidance === 'review' && item.reviewStreakCount >= 2
  ).length;
  return createHistoryListSection('継続Review問題', items, total, (trend) => {
    const item = createHistoryQuestionItem(trend, questions, trend.latestAnsweredAt);
    const state = document.createElement('p');
    state.textContent = `最新状態: ${trend.latestOutcomeId}／連続Review ${trend.reviewStreakCount}回`;
    item.appendChild(state);
    return item;
  });
}

function createHistoryListSection(titleText, items, total, createItem) {
  const section = document.createElement('section');
  const title = document.createElement('h4');
  title.textContent = titleText;
  const count = document.createElement('p');
  count.className = 'analysis-confidence-history__list-count';
  count.textContent = total ? `最新${items.length}件 / 全${total}件` : '該当する履歴はありません。';
  const list = document.createElement('ol');
  list.className = 'analysis-confidence-history__list';
  items.forEach((item) => list.appendChild(createItem(item)));
  section.append(title, count, list);
  return section;
}

function createHistoryQuestionItem(source, questions, date) {
  const item = document.createElement('li');
  const question = (Array.isArray(questions) ? questions : []).find(
    ({ id }) => id === source.questionId
  );
  const heading = document.createElement('h5');
  heading.textContent = `問題ID: ${source.questionId}`;
  const meta = document.createElement('p');
  meta.textContent = `Section ${source.section}・${formatDateTime(date)}`;
  const preview = document.createElement('p');
  preview.textContent = question?.question ?? '現在の問題データに問題文がありません。';
  item.append(heading, meta, preview);
  return item;
}

function formatHistoryRate(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : '未算出';
}

function createConfidenceCoverageMetrics(coverage, review) {
  const metrics = document.createElement('dl');
  metrics.className = 'analysis-confidence-coverage';
  const values = [
    ['安定理解', review.advanceQuestionCount, 'advance'],
    ['要確認', review.reviewQuestionCount, 'review'],
    ['分析対象', coverage.classifiedQuestionCount, 'classified'],
    ['未判定', coverage.unclassifiedQuestionCount, 'unclassified'],
  ];
  for (const [labelText, value, metric] of values) {
    const item = document.createElement('div');
    item.dataset.confidenceMetric = metric;
    const label = document.createElement('dt');
    label.textContent = labelText;
    const count = document.createElement('dd');
    count.textContent = `${formatSummaryCount(value)}問`;
    item.append(label, count);
    metrics.appendChild(item);
  }
  return metrics;
}

function createConfidenceLevel(level) {
  const article = document.createElement('article');
  article.className = 'analysis-confidence-level';
  article.dataset.confidenceLevel = level.id;
  const title = document.createElement('h5');
  title.textContent = level.label;
  const metrics = document.createElement('dl');
  for (const [labelText, value] of [
    ['問題数', `${formatSummaryCount(level.questionCount)}問`],
    ['正解数', `${formatSummaryCount(level.correctCount)}問`],
    ['誤答数', `${formatSummaryCount(level.wrongCount)}問`],
    [
      '最新評価ベース正答率',
      level.accuracyRate === null ? '未算出' : `${Math.round(level.accuracyRate * 100)}%`,
    ],
  ]) {
    const label = document.createElement('dt');
    label.textContent = labelText;
    const data = document.createElement('dd');
    if (labelText === '最新評価ベース正答率')
      data.className = 'analysis-confidence-level__accuracy';
    data.textContent = value;
    metrics.append(label, data);
  }
  article.append(title, metrics);
  return article;
}

function createConfidenceOutcome(outcome, highlight) {
  const article = document.createElement('article');
  article.className = 'analysis-confidence-outcome';
  article.dataset.outcome = outcome.id;
  article.dataset.guidance = outcome.guidance;
  article.dataset.result = outcome.result;
  article.dataset.confidenceLevel = outcome.confidence;
  article.setAttribute('role', 'cell');
  const axisLabel = document.createElement('p');
  axisLabel.className = 'analysis-confidence-outcome__axis';
  axisLabel.textContent = getConfidenceAxisLabel(outcome.confidence);
  const title = document.createElement('h5');
  title.textContent = outcome.title;
  const detail = document.createElement('p');
  detail.textContent = `${formatSummaryCount(outcome.questionCount)}問・${outcome.guidance === 'advance' ? '安定理解' : '要確認'}`;
  article.append(axisLabel, title, detail);
  if (highlight) {
    const emphasis = document.createElement('p');
    emphasis.className = 'analysis-confidence-outcome__highlight';
    emphasis.innerHTML = `<strong>重点</strong><span>${highlight.reasonCode === 'misconception-risk' ? '誤認リスク' : '正解の再現性不足'}</span>`;
    article.appendChild(emphasis);
  }
  article.append(
    createReviewTargetButton({
      label: 'この状態の問題を見る',
      targetType: 'confidenceOutcome',
      targetValueName: 'reviewTargetOutcome',
      targetValue: outcome.id,
      disabled: !Number(outcome.questionCount),
    })
  );
  return article;
}

function createConfidenceOutcomeMatrix(outcomesSource, highlightsSource) {
  const matrix = document.createElement('div');
  matrix.className = 'analysis-confidence-outcomes';
  matrix.setAttribute('role', 'table');
  matrix.setAttribute('aria-label', '正誤と確信度の6分類');
  const outcomes = Array.isArray(outcomesSource) ? outcomesSource : [];
  const outcomeByPair = new Map(
    outcomes.map((outcome) => [`${outcome.result}:${outcome.confidence}`, outcome])
  );
  const highlightById = new Map(
    (Array.isArray(highlightsSource) ? highlightsSource : []).map((item) => [item.outcomeId, item])
  );

  const header = document.createElement('div');
  header.className = 'analysis-confidence-outcomes__header';
  header.setAttribute('role', 'row');
  header.appendChild(createMatrixHeader('', 'columnheader'));
  for (const level of ['high', 'medium', 'low']) {
    header.appendChild(createMatrixHeader(getConfidenceAxisLabel(level), 'columnheader'));
  }
  matrix.appendChild(header);

  for (const result of ['correct', 'wrong']) {
    const row = document.createElement('div');
    row.className = 'analysis-confidence-outcomes__row';
    row.dataset.result = result;
    row.setAttribute('role', 'row');
    row.appendChild(createMatrixHeader(result === 'correct' ? '正解' : '不正解', 'rowheader'));
    for (const level of ['high', 'medium', 'low']) {
      const outcome = outcomeByPair.get(`${result}:${level}`);
      if (outcome) row.appendChild(createConfidenceOutcome(outcome, highlightById.get(outcome.id)));
    }
    matrix.appendChild(row);
  }
  return matrix;
}

function createMatrixHeader(label, role) {
  const header = document.createElement('div');
  header.className = 'analysis-confidence-outcomes__axis-heading';
  header.setAttribute('role', role);
  header.textContent = label;
  return header;
}

function getConfidenceAxisLabel(level) {
  return { high: '確信あり', medium: '迷いあり', low: '自信なし' }[level] ?? level;
}

function getConfidenceCoverageMessage(coverage) {
  if (coverage.status === 'complete') return '全問題の最新理解状態を分析できています。';
  if (coverage.status === 'partial') {
    return `全${formatSummaryCount(coverage.totalQuestionCount)}問中、${formatSummaryCount(coverage.classifiedQuestionCount)}問を分析しています。未判定は${formatSummaryCount(coverage.unclassifiedQuestionCount)}問です。`;
  }
  return '確信度付きの最新評価はまだありません。問題に回答すると理解状態が表示されます。';
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

  const items = Array.isArray(targetPlan.items) ? targetPlan.items : [];
  if (!targetPlan.emptyState && items.length > 0) {
    const actionRow = document.createElement('div');
    actionRow.className = 'weakness-review-targets-panel__actions';

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'primary';
    startButton.dataset.weaknessReviewStart = 'true';
    startButton.textContent = 'この条件で復習する';

    actionRow.appendChild(startButton);
    panel.appendChild(actionRow);
  }

  if (targetPlan.emptyState) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'weakness-review-targets-panel__empty';

    const emptyTitle = document.createElement('p');
    emptyTitle.className = 'weakness-review-targets-panel__empty-title';
    emptyTitle.textContent = '該当する問題はありません';

    const emptyDescription = document.createElement('p');
    emptyDescription.className = 'weakness-review-targets-panel__empty-description';
    emptyDescription.textContent =
      '選択した条件に一致する問題がありません。分析画面に戻り、別の条件を選び直してください。';

    emptyMessage.append(emptyTitle, emptyDescription);
    panel.appendChild(emptyMessage);
    return;
  }

  const list = document.createElement('div');
  list.className = 'weakness-review-targets-list';

  const omitSectionInCards = targetPlan.condition?.type === 'section';
  items.forEach((item) =>
    list.appendChild(createWeaknessReviewTargetItem(item, { omitSection: omitSectionInCards }))
  );

  panel.appendChild(list);
}

function createWeaknessReviewTargetItem(itemSource, options = {}) {
  const item = itemSource && typeof itemSource === 'object' ? itemSource : {};
  const article = document.createElement('article');
  article.className = 'weakness-review-target-item';

  const header = document.createElement('div');
  header.className = 'weakness-review-target-item__header';

  const id = document.createElement('h4');
  id.className = 'weakness-review-target-item__id';
  id.textContent = formatTargetQuestionId(item.id);

  header.appendChild(id);

  if (options.omitSection !== true) {
    const section = document.createElement('p');
    section.className = 'weakness-review-target-item__section';
    section.textContent = formatTargetSectionLabel(item);
    header.appendChild(section);
  }

  const question = document.createElement('p');
  question.className = 'weakness-review-target-item__question';
  question.textContent = getQuestionPreview(item.questionText) || '問題文を表示できません。';

  const meta = document.createElement('dl');
  meta.className = 'weakness-review-target-item__meta';
  meta.append(
    createTargetMetaItem('状態', formatTargetStatus(item.status)),
    createTargetMetaItem('解答', `${formatSummaryCount(item.seenCount)}回`),
    createTargetMetaItem('正答', `${formatSummaryCount(item.correctCount)}問`),
    createTargetMetaItem('誤答', `${formatSummaryCount(item.wrongCount)}問`)
  );
  if (item.latestUnderstanding) {
    meta.append(
      createTargetMetaItem('最新理解状態', item.latestUnderstanding.title),
      createTargetMetaItem(
        '結果',
        item.latestUnderstanding.result === 'correct' ? '正解' : '不正解'
      ),
      createTargetMetaItem('確信度', item.latestUnderstanding.confidenceLabel),
      createTargetMetaItem(
        '判断',
        item.latestUnderstanding.guidance === 'advance' ? '安定理解' : '要確認'
      )
    );
  }

  const badges = document.createElement('div');
  badges.className = 'weakness-review-target-item__badges';
  appendTargetBadge(badges, item.hasWrongReasonTags, '誤答理由あり');
  appendTargetBadge(badges, item.hasNote, 'メモあり');
  appendTargetBadge(badges, item.bookmarked, 'ブックマーク');

  article.append(header, question, meta);
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

function formatTargetQuestionId(idSource) {
  const id = typeof idSource === 'string' && idSource.trim() ? idSource.trim() : '問題ID未設定';
  return `問題ID: ${id}`;
}

function formatTargetSectionLabel(item) {
  const section = formatSectionNumber(item.section);
  const sectionTitle = typeof item.sectionTitle === 'string' ? item.sectionTitle.trim() : '';
  const sectionLabel = section ? `Section ${section}` : 'Section';
  return sectionTitle ? `${sectionLabel}：${sectionTitle}` : sectionLabel;
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

  const actions = document.createElement('dd');
  actions.className = 'analysis-tag-item__actions';
  actions.appendChild(
    createReviewTargetButton({
      label: 'この理由の問題を見る',
      targetType: 'wrongReasonTag',
      targetValueName: 'reviewTargetTag',
      targetValue: tag.id,
    })
  );

  item.append(label, count, actions);
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
  const sectionNumber = formatSectionNumber(summary.section);
  if (sectionNumber) {
    section.appendChild(
      createReviewTargetButton({
        label: 'このSectionの問題を見る',
        targetType: 'section',
        targetValueName: 'reviewTargetSection',
        targetValue: sectionNumber,
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
      { sectionHeading: getSectionHeadingParts(sectionSummary) }
    );
    card.classList.add('analysis-section-card');
    list.appendChild(card);
  });

  content.appendChild(list);
  return wrapper;
}

function createReviewTargetButton({
  label,
  targetType,
  targetValueName,
  targetValue,
  disabled = false,
}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'analysis-review-target-button';
  button.textContent = label;
  button.dataset.reviewTargetType = targetType;
  button.dataset[targetValueName] = String(targetValue ?? '');
  button.disabled = disabled || !button.dataset[targetValueName];
  return button;
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
  const shouldClearConfidenceHistory = Boolean(plan?.confidenceHistory?.shouldClear);
  const resetQuestionCount = formatSummaryCount(impact.resetQuestionCount);
  const retainedNoteCount = formatSummaryCount(impact.retainedNoteCount);
  const retainedBookmarkCount = formatSummaryCount(impact.retainedBookmarkCount);
  const historyCount = impact.hasUnsupportedConfidenceHistory
    ? '削除予定（このバージョンでは件数確認不可）'
    : `${formatSummaryCount(impact.resetConfidenceAttemptCount)}件削除予定`;

  container.replaceChildren();

  const hasResetTargets = Number(impact.resetQuestionCount) > 0;
  const lead = document.createElement('p');
  lead.className = 'learning-history-reset-summary__lead';
  if (hasResetTargets) {
    lead.textContent = `${resetQuestionCount}問の学習履歴がリセット対象です。保持されるデータもあわせて確認できます。`;
  } else if (shouldClearConfidenceHistory) {
    lead.textContent = shouldClearActiveSession
      ? '回答試行履歴がリセット対象です。リセットを確定すると中断データも削除されます。'
      : '回答試行履歴がリセット対象です。削除内容と保持されるデータを確認してください。';
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
    createLearningHistoryResetCard('回答試行履歴', historyCount),
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
      '回答試行履歴（正誤・確信度・回答日時）',
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
