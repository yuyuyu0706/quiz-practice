const STORAGE_KEYS = {
  progress: 'deaQuizProgress',
  settings: 'deaQuizSettings',
  session: 'deaQuizSession',
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
  const savedSession = loadJSON(STORAGE_KEYS.session, null);
  if (savedSession && savedSession.order?.length) {
    els.homeMessage.textContent = '前回のセッションを検出しました。続きから再開できます。';
  }
}

function attachEvents() {
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const ok = saveSettingsFromUI();
    if (ok) startSession(state.settings.mode);
  });

  els.resumeBtn.addEventListener('click', () => {
    const saved = loadJSON(STORAGE_KEYS.session, null);
    if (!saved || !saved.order?.length) {
      els.homeMessage.textContent = '再開できるセッションがありません。';
      return;
    }
    state.session = saved;
    showView('quiz');
    renderQuestion();
  });

  els.submitAnswer.addEventListener('click', submitCurrentAnswer);
  els.prevQuestion.addEventListener('click', () => moveQuestion(-1));
  els.nextQuestion.addEventListener('click', () => moveQuestion(1));

  els.toggleExplanation.addEventListener('click', () => {
    els.explanation.classList.toggle('hidden');
    els.toggleExplanation.textContent = els.explanation.classList.contains('hidden')
      ? '解説を表示'
      : '解説を非表示';
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
    mode,
    order: finalList.map((q) => q.id),
    currentIndex: 0,
    answers: {},
    graded: {},
    completedAt: null,
    explanationOpen: false,
  };

  saveJSON(STORAGE_KEYS.session, state.session);
  showView('quiz');
  renderQuestion();
}

function renderQuestion() {
  const question = getCurrentQuestion();
  const idx = state.session.currentIndex + 1;
  const total = state.session.order.length;
  const chosen = state.session.answers[question.id] ?? null;
  const graded = state.session.graded[question.id];

  els.quizSection.textContent = `Section ${question.section}: ${question.sectionTitle}`;
  els.quizProgress.textContent = `${idx} / ${total}`;
  els.quizQuestion.textContent = `${question.id}. ${question.question}`;
  els.resultIndicator.textContent = '';
  els.resultIndicator.className = 'indicator';
  els.quizMessage.textContent = '';

  const choices = Object.entries(question.choices)
    .map(([key, text]) => {
      const checked = chosen === key ? 'checked' : '';
      return `<label data-choice="${key}"><input type="radio" name="choice" value="${key}" ${checked}/> ${key}. ${text}</label>`;
    })
    .join('');
  els.choicesForm.innerHTML = choices;

  els.explanation.textContent = question.explanation;
  els.explanation.classList.toggle('hidden', !state.session.explanationOpen);
  els.toggleExplanation.textContent = state.session.explanationOpen ? '解説を非表示' : '解説を表示';

  if (graded) {
    applyGradedState(question, chosen);
  }

  updateBookmarkLabel(state.progress[question.id]?.bookmark);
  saveJSON(STORAGE_KEYS.session, state.session);
}

function submitCurrentAnswer() {
  const question = getCurrentQuestion();
  const selected = els.choicesForm.querySelector('input[name="choice"]:checked');
  if (!selected) {
    els.quizMessage.textContent = '選択肢を選んでから回答してください。';
    return;
  }

  const chosen = selected.value;
  state.session.answers[question.id] = chosen;
  state.session.graded[question.id] = true;
  state.session.explanationOpen = true;

  const correct = chosen === question.answer;
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

function applyGradedState(question, chosen) {
  const correct = chosen === question.answer;
  els.resultIndicator.textContent = correct
    ? `✅ 正解（正答: ${question.answer}）`
    : `❌ 不正解（正答: ${question.answer}）`;
  els.resultIndicator.classList.add(correct ? 'ok' : 'ng');

  els.choicesForm.querySelectorAll('label').forEach((label) => {
    const key = label.dataset.choice;
    if (key === question.answer) label.classList.add('correct');
    if (key === chosen && key !== question.answer) label.classList.add('wrong');
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
    const answer = state.session.answers[id];
    const isCorrect = answer === q.answer;
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
  saveJSON(STORAGE_KEYS.session, state.session);
  showView('result');
}

function getCurrentQuestion() {
  const id = state.session.order[state.session.currentIndex];
  return state.questions.find((q) => q.id === id);
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
