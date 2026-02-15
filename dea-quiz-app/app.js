const FIXED_CHOICE_LABELS = ['A', 'B', 'C', 'D'];

const STORAGE_KEYS = {
  progress: 'deaQuizProgress',
  settings: 'deaQuizSettings',
  session: 'deaQuizActiveSession',
};

const state = {
  questions: [],
  progress: loadJSON(STORAGE_KEYS.progress, {}),
  settings: loadJSON(STORAGE_KEYS.settings, {
    sections: ['1', '2', '3', '4', '5'],
    mode: 'normal',
    count: '50',
  }),
  session: null,
};

const els = {
  views: {
    home: document.getElementById('home-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view'),
  },
  form: document.getElementById('settings-form'),
  sectionCheckboxes: document.getElementById('section-checkboxes'),
  questionCount: document.getElementById('question-count'),
  resumeBtn: document.getElementById('resume-btn'),
  discardSessionBtn: document.getElementById('discard-session-btn'),
  homeMessage: document.getElementById('home-message'),
  quizSection: document.getElementById('quiz-section'),
  quizProgress: document.getElementById('quiz-progress'),
  quizQuestion: document.getElementById('quiz-question'),
  choicesForm: document.getElementById('choices-form'),
  resultIndicator: document.getElementById('result-indicator'),
  explanation: document.getElementById('explanation'),
  quizMessage: document.getElementById('quiz-message'),
  submitAnswer: document.getElementById('submit-answer'),
  prevQuestion: document.getElementById('prev-question'),
  nextQuestion: document.getElementById('next-question'),
  toggleExplanation: document.getElementById('toggle-explanation'),
  bookmarkBtn: document.getElementById('bookmark-btn'),
  suspendToHome: document.getElementById('suspend-to-home'),
  scoreText: document.getElementById('score-text'),
  sectionScoreText: document.getElementById('section-score-text'),
  wrongList: document.getElementById('wrong-list'),
  retryWrong: document.getElementById('retry-wrong'),
  backHome: document.getElementById('back-home'),
};

init();

async function init() {
  state.questions = await loadQuestions();
  buildSectionCheckboxes();
  hydrateSettingsUI();
  attachEvents();
  refreshResumeUI();
}

function attachEvents() {
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const ok = saveSettingsFromUI();
    if (ok) startSession(state.settings.mode);
  });

  els.resumeBtn.addEventListener('click', () => {
    const saved = loadSession();
    if (!saved) {
      els.homeMessage.textContent = '再開できるセッションがありません。';
      refreshResumeUI();
      return;
    }
    state.session = saved;
    showView('quiz');
    renderQuestion();
  });

  els.discardSessionBtn.addEventListener('click', () => {
    clearSession();
    state.session = null;
    els.homeMessage.textContent = '中断データを削除しました。';
    refreshResumeUI();
  });

  els.submitAnswer.addEventListener('click', submitCurrentAnswer);
  els.prevQuestion.addEventListener('click', () => moveQuestion(-1));
  els.nextQuestion.addEventListener('click', () => moveQuestion(1));

  els.toggleExplanation.addEventListener('click', () => {
    els.explanation.classList.toggle('hidden');
    state.session.explanationOpen = !els.explanation.classList.contains('hidden');
    els.toggleExplanation.textContent = state.session.explanationOpen ? '解説を非表示' : '解説を表示';
    persistSession();
  });

  els.bookmarkBtn.addEventListener('click', () => {
    const q = getCurrentQuestion();
    const current = state.progress[q.id] ?? baseProgress();
    current.bookmark = !current.bookmark;
    state.progress[q.id] = current;
    saveJSON(STORAGE_KEYS.progress, state.progress);
    updateBookmarkLabel(current.bookmark);
  });

  els.retryWrong.addEventListener('click', () => startSession('wrongOnly'));
  els.backHome.addEventListener('click', () => {
    showView('home');
    refreshResumeUI();
  });

  els.suspendToHome.addEventListener('click', () => {
    if (!state.session) return;
    persistSession();
    showView('home');
    els.homeMessage.textContent = '中断状態を保存しました。';
    refreshResumeUI();
  });

  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(event) {
  if (!state.session || els.views.quiz.className.indexOf('active') === -1) return;
  const key = event.key.toUpperCase();
  const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', A: 'A', B: 'B', C: 'C', D: 'D' };
  if (map[key]) {
    const choiceInput = els.choicesForm.querySelector(`input[value="${map[key]}"]`);
    if (choiceInput) choiceInput.checked = true;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    submitCurrentAnswer();
  } else if (event.key === 'ArrowRight') {
    moveQuestion(1);
  } else if (event.key === 'ArrowLeft') {
    moveQuestion(-1);
  }
}

function startSession(forcedMode = null) {
  const mode = forcedMode ?? state.settings.mode;
  const selected = state.questions.filter((q) => state.settings.sections.includes(q.section));
  let pool = selected;

  if (mode === 'wrongOnly') {
    pool = selected.filter((q) => (state.progress[q.id]?.wrongCount ?? 0) > 0);
  } else if (mode === 'bookmarks') {
    pool = selected.filter((q) => state.progress[q.id]?.bookmark);
  }

  if (!pool.length) {
    els.homeMessage.textContent = '対象となる問題がありません。設定を変更してください。';
    return;
  }

  if (mode === 'random') {
    pool = shuffle([...pool]);
  }

  const count = state.settings.count === 'all' ? pool.length : Number(state.settings.count);
  const finalList = pool.slice(0, Math.min(count, pool.length));

  state.session = {
    schemaVersion: 1,
    app: 'dea-quiz-app',
    mode,
    order: finalList.map((q) => q.id),
    currentIndex: 0,
    answers: {},
    choiceMap: {},
    graded: {},
    completedAt: null,
    explanationOpen: false,
    startedAt: new Date().toISOString(),
    settingsSnapshot: { ...state.settings, mode },
  };

  persistSession();
  showView('quiz');
  renderQuestion();
}

function renderQuestion() {
  const question = getCurrentQuestion();
  const idx = state.session.currentIndex + 1;
  const total = state.session.order.length;
  const choiceMap = getOrCreateChoiceMap(question.id, question.choices);
  const chosen = getStoredSelectedLabel(question.id, question.choices, choiceMap);
  const graded = state.session.graded[question.id];

  els.quizSection.textContent = `Section ${question.section}: ${question.sectionTitle}`;
  els.quizProgress.textContent = `${idx} / ${total}`;
  els.quizQuestion.textContent = `${question.id}. ${question.question}`;
  els.resultIndicator.textContent = '';
  els.resultIndicator.className = 'indicator';
  els.quizMessage.textContent = '';

  const choices = getChoiceLabels(question.choices)
    .map((label) => {
      const originalKey = choiceMap[label];
      const text = question.choices[originalKey];
      const checked = chosen === label ? 'checked' : '';
      return `<label data-choice="${label}"><input type="radio" name="choice" value="${label}" ${checked}/> ${label}. ${text}</label>`;
    })
    .join('');
  els.choicesForm.innerHTML = choices;

  renderExplanation(question);
  els.explanation.classList.toggle('hidden', !state.session.explanationOpen);
  els.toggleExplanation.textContent = state.session.explanationOpen ? '解説を非表示' : '解説を表示';

  if (graded) {
    applyGradedState(question, chosen, choiceMap);
  }

  updateBookmarkLabel(state.progress[question.id]?.bookmark);
  persistSession();
}

function renderExplanation(question) {
  const explanation = typeof question.explanation === 'string' ? question.explanation : '';
  const references = Array.isArray(question.references) ? question.references : [];
  els.explanation.replaceChildren();

  const body = renderMarkdownToFragment(explanation);
  els.explanation.appendChild(body);

  const validReferences = references.filter(
    (item) => item && typeof item.title === 'string' && typeof item.url === 'string' && item.title && item.url,
  );
  if (!validReferences.length) return;

  const section = document.createElement('section');
  section.className = 'references';

  const title = document.createElement('h3');
  title.textContent = '参考リンク';
  section.appendChild(title);

  const list = document.createElement('ul');
  validReferences.forEach((item) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.textContent = item.title;
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    li.appendChild(link);
    list.appendChild(li);
  });
  section.appendChild(list);
  els.explanation.appendChild(section);
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
    p.textContent = paragraphBuffer.join('\n').trim();
    fragment.appendChild(p);
    paragraphBuffer.length = 0;
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    const ul = document.createElement('ul');
    listBuffer.forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
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

  if (inCodeBlock) {
    flushCode();
  }
  flushParagraph();
  flushList();

  return fragment;
}

function submitCurrentAnswer() {
  const question = getCurrentQuestion();
  const selected = els.choicesForm.querySelector('input[name="choice"]:checked');
  if (!selected) {
    els.quizMessage.textContent = '選択肢を選んでから回答してください。';
    return;
  }

  const selectedLabel = selected.value;
  const choiceMap = getOrCreateChoiceMap(question.id, question.choices);
  state.session.answers[question.id] = selectedLabel;
  state.session.graded[question.id] = true;
  state.session.explanationOpen = true;

  const correct = choiceMap[selectedLabel] === question.answer;
  const currentProgress = state.progress[question.id] ?? baseProgress();
  currentProgress.seenCount += 1;
  if (correct) {
    currentProgress.correctCount += 1;
  } else {
    currentProgress.wrongCount += 1;
  }
  currentProgress.lastAnsweredAt = new Date().toISOString();
  state.progress[question.id] = currentProgress;

  saveJSON(STORAGE_KEYS.progress, state.progress);
  renderQuestion();
}

function applyGradedState(question, chosenLabel, choiceMap) {
  const correctLabel = getChoiceLabels(question.choices).find((label) => choiceMap[label] === question.answer);
  const correct = chosenLabel === correctLabel;
  els.resultIndicator.textContent = correct
    ? `✅ 正解（正答: ${correctLabel}）`
    : `❌ 不正解（正答: ${correctLabel}）`;
  els.resultIndicator.classList.add(correct ? 'ok' : 'ng');

  els.choicesForm.querySelectorAll('label').forEach((label) => {
    const labelKey = label.dataset.choice;
    if (labelKey === correctLabel) label.classList.add('correct');
    if (labelKey === chosenLabel && labelKey !== correctLabel) label.classList.add('wrong');
  });
}

function moveQuestion(delta) {
  const question = getCurrentQuestion();
  if (delta > 0 && !state.session.graded[question.id]) {
    els.quizMessage.textContent = '未回答です。「回答する」で採点してください。';
    return;
  }
  const nextIndex = state.session.currentIndex + delta;
  if (nextIndex < 0) return;

  if (nextIndex >= state.session.order.length) {
    finishSession();
    return;
  }
  state.session.currentIndex = nextIndex;
  state.session.explanationOpen = false;
  renderQuestion();
}

function finishSession() {
  const ids = state.session.order;
  let correctCount = 0;
  const wrongItems = [];
  const sectionStats = {};

  ids.forEach((id) => {
    const q = state.questions.find((item) => item.id === id);
    const choiceMap = getOrCreateChoiceMap(id, q.choices);
    const selectedLabel = getStoredSelectedLabel(id, q.choices, choiceMap);
    const isCorrect = selectedLabel ? choiceMap[selectedLabel] === q.answer : false;
    if (isCorrect) correctCount += 1;
    else wrongItems.push(q);

    if (!sectionStats[q.section]) {
      sectionStats[q.section] = { ok: 0, total: 0 };
    }
    sectionStats[q.section].total += 1;
    if (isCorrect) sectionStats[q.section].ok += 1;
  });

  const total = ids.length;
  const rate = Math.round((correctCount / total) * 100);
  els.scoreText.textContent = `スコア: ${correctCount} / ${total}（${rate}%）`;

  const sectionText = Object.entries(sectionStats)
    .map(([sec, stat]) => `S${sec}: ${Math.round((stat.ok / stat.total) * 100)}%`)
    .join(' / ');
  els.sectionScoreText.textContent = `セクション別: ${sectionText}`;

  els.wrongList.innerHTML = '';
  if (!wrongItems.length) {
    els.wrongList.innerHTML = '<li>全問正解です！</li>';
  } else {
    wrongItems.forEach((q) => {
      const li = document.createElement('li');
      li.textContent = `${q.id}: ${q.question.slice(0, 50)}...`;
      els.wrongList.appendChild(li);
    });
  }

  state.session.completedAt = new Date().toISOString();
  clearSession();
  state.session = null;
  refreshResumeUI();
  showView('result');
}

function getCurrentQuestion() {
  const id = state.session.order[state.session.currentIndex];
  return state.questions.find((q) => q.id === id);
}


function refreshResumeUI() {
  const saved = loadSession();
  const hasSession = Boolean(saved);
  els.resumeBtn.classList.toggle('hidden', !hasSession);
  els.discardSessionBtn.classList.toggle('hidden', !hasSession);
  if (hasSession) {
    els.homeMessage.textContent = '前回のセッションを検出しました。続きから再開できます。';
  } else if (els.homeMessage.textContent.includes('前回のセッション')) {
    els.homeMessage.textContent = '';
  }
}

function loadSession() {
  const saved = loadJSON(STORAGE_KEYS.session, null);
  if (!saved) return null;
  if (!Array.isArray(saved.order) || saved.order.length === 0) {
    clearSession();
    return null;
  }
  const idx = Number(saved.currentIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= saved.order.length) {
    clearSession();
    return null;
  }

  const session = {
    schemaVersion: saved.schemaVersion ?? 1,
    app: saved.app ?? 'dea-quiz-app',
    mode: saved.mode ?? 'normal',
    order: saved.order,
    currentIndex: idx,
    answers: saved.answers ?? {},
    choiceMap: saved.choiceMap ?? {},
    graded: saved.graded ?? {},
    completedAt: saved.completedAt ?? null,
    explanationOpen: Boolean(saved.explanationOpen),
    startedAt: saved.startedAt ?? new Date().toISOString(),
    settingsSnapshot: saved.settingsSnapshot ?? null,
  };

  if (session.completedAt) {
    clearSession();
    return null;
  }

  return session;
}

function getChoiceLabels(choices) {
  const keys = Object.keys(choices);
  const hasFixedLabels = FIXED_CHOICE_LABELS.every((label) => keys.includes(label));
  return hasFixedLabels ? [...FIXED_CHOICE_LABELS] : [...keys].sort();
}

function getOrCreateChoiceMap(questionId, choices) {
  const labels = getChoiceLabels(choices);
  const originalKeys = Object.keys(choices);
  const savedMap = state.session.choiceMap[questionId];
  if (isValidChoiceMap(savedMap, labels, originalKeys)) {
    return savedMap;
  }

  const shuffled = shuffle([...originalKeys]);
  const generatedMap = labels.reduce((acc, label, index) => {
    acc[label] = shuffled[index];
    return acc;
  }, {});

  state.session.choiceMap[questionId] = generatedMap;
  return generatedMap;
}

function isValidChoiceMap(map, labels, originalKeys) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return false;
  }

  const mapLabels = Object.keys(map);
  if (mapLabels.length !== labels.length || !labels.every((label) => mapLabels.includes(label))) {
    return false;
  }

  const values = Object.values(map);
  const valueSet = new Set(values);
  return valueSet.size === originalKeys.length && originalKeys.every((key) => valueSet.has(key));
}

function getStoredSelectedLabel(questionId, choices, choiceMap = null) {
  const stored = state.session.answers[questionId] ?? null;
  if (!stored) return null;

  const labels = getChoiceLabels(choices);
  if (labels.includes(stored)) {
    return stored;
  }

  const map = choiceMap ?? getOrCreateChoiceMap(questionId, choices);
  return labels.find((label) => map[label] === stored) ?? null;
}

function persistSession() {
  if (!state.session) return;
  state.session.savedAt = new Date().toISOString();
  saveJSON(STORAGE_KEYS.session, state.session);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function showView(name) {
  Object.entries(els.views).forEach(([key, node]) => {
    node.classList.toggle('active', key === name);
  });
}

function buildSectionCheckboxes() {
  const sections = Array.from(new Set(state.questions.map((q) => q.section)));
  els.sectionCheckboxes.innerHTML = sections
    .map(
      (section) =>
        `<label><input type="checkbox" name="sections" value="${section}" checked /> Section ${section}</label>`,
    )
    .join('');
}

function hydrateSettingsUI() {
  els.questionCount.value = state.settings.count;
  const sections = new Set(state.settings.sections);
  els.sectionCheckboxes.querySelectorAll('input[name="sections"]').forEach((input) => {
    input.checked = sections.has(input.value);
  });
  const modeInput = els.form.querySelector(`input[name="mode"][value="${state.settings.mode}"]`);
  if (modeInput) modeInput.checked = true;
}

function saveSettingsFromUI() {
  const sections = Array.from(els.sectionCheckboxes.querySelectorAll('input:checked')).map((input) => input.value);
  if (!sections.length) {
    els.homeMessage.textContent = '最低1つのセクションを選択してください。';
    return false;
  }
  state.settings = {
    sections,
    mode: els.form.querySelector('input[name="mode"]:checked').value,
    count: els.questionCount.value,
  };
  saveJSON(STORAGE_KEYS.settings, state.settings);
  return true;
}

function updateBookmarkLabel(bookmarkEnabled) {
  els.bookmarkBtn.textContent = bookmarkEnabled ? 'ブックマーク★' : 'ブックマーク☆';
}

async function loadQuestions() {
  const res = await fetch('questions.json');
  if (!res.ok) throw new Error('questions.json の読み込みに失敗しました');
  return res.json();
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function baseProgress() {
  return {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: false,
  };
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
