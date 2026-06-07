import {
  loadProgress,
  saveProgress,
  loadSettings,
  saveSettings,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  getRepairedStorageKeys,
} from './storage.js';
import { baseProgress, deleteNote, getQuestionNote, saveNote } from './notes.js';
import { loadQuestions } from './questions.js';
import {
  createQuizSession,
  getChoiceLabels,
  getOrCreateChoiceMap,
  gradeAnswer,
  buildSessionResult,
  getCurrentQuestion as getCurrentQuestionFromSession,
  getStoredSelectedLabel as getStoredSelectedLabelFromSession,
  normalizeLoadedSession,
} from './quiz-session.js';
import {
  showView as switchView,
  renderQuestion as renderQuestionView,
  renderResult,
  renderStorageRepairNotice,
  formatDateTime,
} from './render.js';
import {
  createSecondaryActionLayoutController,
  scrollChoiceGroupIntoView,
  scrollQuizIntoView,
} from './layout.js';
import { buildSectionCheckboxes, hydrateSettingsUI, readSettingsFromUI } from './settings-view.js';

const state = {
  questions: [],
  progress: loadProgress(),
  settings: loadSettings(),
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
  selectionHint: document.getElementById('selection-hint'),
  quizTopAnchor: document.getElementById('quiz-top-anchor'),
  submitAnswer: document.getElementById('submit-answer'),
  prevQuestion: document.getElementById('prev-question'),
  nextQuestion: document.getElementById('next-question'),
  nextQuestionInline: document.getElementById('next-question-inline'),
  toggleExplanation: document.getElementById('toggle-explanation'),
  secondaryActionsToggle: document.getElementById('secondary-actions-toggle'),
  secondaryActionsPanel: document.getElementById('secondary-actions-panel'),
  suspendMobileSlot: document.getElementById('suspend-mobile-slot'),
  suspendDesktopSlot: document.getElementById('suspend-desktop-slot'),
  explanationActionRow: document.getElementById('explanation-action-row'),
  notePanel: document.getElementById('note-panel'),
  questionNote: document.getElementById('question-note'),
  saveNote: document.getElementById('save-note'),
  clearNote: document.getElementById('clear-note'),
  noteStatus: document.getElementById('note-status'),
  bookmarkBtn: document.getElementById('bookmark-btn'),
  suspendToHome: document.getElementById('suspend-to-home'),
  scoreText: document.getElementById('score-text'),
  sectionScoreText: document.getElementById('section-score-text'),
  wrongList: document.getElementById('wrong-list'),
  retryWrong: document.getElementById('retry-wrong'),
  backHome: document.getElementById('back-home'),
};

const secondaryActionLayout = createSecondaryActionLayoutController(els);
let noteStatusTimer = null;

init();

async function init() {
  state.questions = await loadQuestions();
  buildSectionCheckboxes(els.sectionCheckboxes, state.questions);
  hydrateSettingsUI(els, state.settings);
  attachEvents();
  secondaryActionLayout.syncLayout();
  refreshResumeUI();
  const repairedKeys = getRepairedStorageKeys();
  if (repairedKeys.length > 0) {
    renderStorageRepairNotice(els.views.home, repairedKeys);
  }
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
    renderQuestion({ scrollToTop: true });
  });

  els.discardSessionBtn.addEventListener('click', () => {
    clearSession();
    state.session = null;
    els.homeMessage.textContent = '中断データを削除しました。';
    refreshResumeUI();
  });
  els.submitAnswer.addEventListener('click', submitCurrentAnswer);
  els.prevQuestion.addEventListener('click', () => {
    closeSecondaryActions();
    moveQuestion(-1);
  });
  els.nextQuestion.addEventListener('click', () => {
    closeSecondaryActions();
    moveQuestion(1);
  });
  els.nextQuestionInline.addEventListener('click', () => {
    closeSecondaryActions();
    moveQuestion(1);
  });

  els.secondaryActionsToggle?.addEventListener('click', () => {
    const expanded = els.secondaryActionsToggle.getAttribute('aria-expanded') === 'true';
    secondaryActionLayout.setOpen(!expanded);
  });

  els.choicesForm.addEventListener('change', handleChoiceSelectionChange);
  els.saveNote.addEventListener('click', saveCurrentQuestionNote);
  els.clearNote.addEventListener('click', clearCurrentQuestionNote);
  els.questionNote.addEventListener('input', clearNoteStatusMessage);

  els.toggleExplanation.addEventListener('click', () => {
    closeSecondaryActions();
    els.explanation.classList.toggle('hidden');
    state.session.explanationOpen = !els.explanation.classList.contains('hidden');
    els.toggleExplanation.textContent = state.session.explanationOpen
      ? '解説を非表示'
      : '解説を表示';
    updateExplanationActions();
    persistSession();
  });

  els.bookmarkBtn.addEventListener('click', () => {
    closeSecondaryActions();
    const q = getCurrentQuestion();
    const current = { ...baseProgress(), ...(state.progress[q.id] ?? {}) };
    current.bookmark = !current.bookmark;
    state.progress[q.id] = current;
    saveProgress(state.progress);
    updateBookmarkLabel(current.bookmark);
  });
  els.retryWrong.addEventListener('click', () => startSession('wrongOnly'));
  els.backHome.addEventListener('click', () => {
    showView('home');
    refreshResumeUI();
  });
  els.suspendToHome.addEventListener('click', () => {
    if (!state.session) return;
    closeSecondaryActions();
    persistSession();
    showView('home');
    els.homeMessage.textContent = '中断状態を保存しました。';
    refreshResumeUI();
  });

  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('click', secondaryActionLayout.handleDocumentClick);
  window.addEventListener('resize', secondaryActionLayout.handleViewportChange);
}

function closeSecondaryActions(options = {}) {
  secondaryActionLayout.close(options);
}

function handleKeyboard(event) {
  if (!state.session || els.views.quiz.className.indexOf('active') === -1) return;
  if (event.target === els.questionNote) return;
  const key = event.key.toUpperCase();
  const map = {
    1: 'A',
    2: 'B',
    3: 'C',
    4: 'D',
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
  };
  if (map[key]) {
    const choiceInput = els.choicesForm.querySelector(`input[value="${map[key]}"]`);
    if (choiceInput) {
      choiceInput.checked = true;
      handleChoiceSelectionChange();
    }
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
  let { pool, session } = createQuizSession(state.questions, state.settings, mode, state.progress);

  if (!pool.length) {
    els.homeMessage.textContent = '対象となる問題がありません。設定を変更してください。';
    return;
  }

  state.session = session;

  persistSession();
  showView('quiz');
  renderQuestion({ scrollToTop: true });
}

function renderQuestion(options = {}) {
  const { scrollToTop = false } = options;
  const question = getCurrentQuestion();
  const idx = state.session.currentIndex + 1;
  const total = state.session.order.length;
  const choiceMap = getOrCreateChoiceMap(state.session, question.id, question.choices);
  const chosen = getStoredSelectedLabel(question.id, question.choices, choiceMap);
  const graded = state.session.graded[question.id];
  renderQuestionView(els, {
    question,
    idx,
    total,
    choiceLabels: getChoiceLabels(question.choices),
    choiceMap,
    chosen,
    graded,
    explanationOpen: state.session.explanationOpen,
    bookmarkEnabled: state.progress[question.id]?.bookmark,
  });
  updatePrimaryActions(question.id);
  updateExplanationActions();
  renderQuestionNote(question.id);
  persistSession();
  closeSecondaryActions();
  if (scrollToTop) scrollQuizIntoView(els.quizTopAnchor, els.views.quiz);
}

function submitCurrentAnswer(event) {
  event?.preventDefault?.();
  const question = getCurrentQuestion();
  const selected = els.choicesForm.querySelector('input[name="choice"]:checked');
  if (!selected) {
    els.quizMessage.textContent = '選択肢を1つ選んでから「回答する」を押してください。';
    els.choicesForm.classList.add('needs-selection');
    els.selectionHint.textContent = '未選択です。まずは選択肢をタップしてください。';
    scrollChoiceGroupIntoView(els.choicesForm);
    return;
  }

  els.choicesForm.classList.remove('needs-selection');

  const selectedLabel = selected.value;
  const choiceMap = getOrCreateChoiceMap(state.session, question.id, question.choices);
  state.session.answers[question.id] = selectedLabel;
  state.session.graded[question.id] = true;
  state.session.explanationOpen = true;

  const correct = gradeAnswer(question, selectedLabel, choiceMap);
  const currentProgress = { ...baseProgress(), ...(state.progress[question.id] ?? {}) };
  currentProgress.seenCount += 1;
  if (correct) {
    currentProgress.correctCount += 1;
  } else {
    currentProgress.wrongCount += 1;
  }
  currentProgress.lastAnsweredAt = new Date().toISOString();
  state.progress[question.id] = currentProgress;

  saveProgress(state.progress);
  renderQuestion();
}

function renderQuestionNote(questionId) {
  const graded = Boolean(state.session?.graded?.[questionId]);
  const progress = { ...baseProgress(), ...(state.progress?.[questionId] ?? {}) };

  els.notePanel.classList.toggle('hidden', !graded);
  els.questionNote.value = getQuestionNote(state.progress, questionId);
  els.noteStatus.textContent = progress.noteUpdatedAt
    ? `最終保存: ${formatDateTime(progress.noteUpdatedAt)}`
    : '';
}

function saveCurrentQuestionNote() {
  const question = getCurrentQuestion();
  if (!question || !state.session?.graded?.[question.id]) return;

  state.progress = saveNote(state.progress, question.id, els.questionNote.value);
  saveProgress(state.progress);

  const noteText = state.progress[question.id]?.noteText?.trim();
  updateNoteStatus(noteText ? 'メモを保存しました。' : 'メモを空にしました。');
}

function clearCurrentQuestionNote() {
  const question = getCurrentQuestion();
  if (!question || !state.session?.graded?.[question.id]) return;

  state.progress = deleteNote(state.progress, question.id);
  saveProgress(state.progress);
  els.questionNote.value = '';
  updateNoteStatus('メモを削除しました。');
}

function clearNoteStatusMessage() {
  if (noteStatusTimer) {
    window.clearTimeout(noteStatusTimer);
    noteStatusTimer = null;
  }
  els.noteStatus.textContent = '';
}

function updateNoteStatus(message) {
  els.noteStatus.textContent = message;
  if (noteStatusTimer) window.clearTimeout(noteStatusTimer);
  noteStatusTimer = window.setTimeout(() => {
    const question = getCurrentQuestion();
    if (question) renderQuestionNote(question.id);
  }, 1800);
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
  renderQuestion({ scrollToTop: true });
}

function handleChoiceSelectionChange() {
  els.quizMessage.textContent = '';
  els.choicesForm.classList.remove('needs-selection');
  updatePrimaryActions(getCurrentQuestion()?.id);
}

function updatePrimaryActions(questionId) {
  const selected = els.choicesForm.querySelector('input[name="choice"]:checked');
  const graded = Boolean(state.session?.graded?.[questionId]);
  const canSubmit = Boolean(selected) && !graded;
  const canNext = graded;

  els.submitAnswer.disabled = !canSubmit;
  els.nextQuestion.disabled = !canNext;
  els.nextQuestionInline.disabled = !canNext;
  els.selectionHint.hidden = graded;

  if (selected) {
    els.selectionHint.textContent = '選択済みです。「回答する」で採点します。';
  } else {
    els.selectionHint.textContent = '選択肢を選ぶと「回答する」が押せます。';
  }
}

function updateExplanationActions() {
  const question = getCurrentQuestion();
  const graded = Boolean(question && state.session?.graded?.[question.id]);
  const showInlineNext = graded && !els.explanation.classList.contains('hidden');
  els.explanationActionRow.classList.toggle('hidden', !showInlineNext);
}

function finishSession() {
  const result = buildSessionResult(
    state.session,
    state.questions,
    state.progress,
    getStoredSelectedLabel
  );
  renderResult(els, result);
  state.session.completedAt = new Date().toISOString();
  clearSession();
  state.session = null;
  refreshResumeUI();
  showView('result');
}

function getCurrentQuestion() {
  return getCurrentQuestionFromSession(state.session, state.questions);
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
  const rawSession = loadActiveSession();
  const session = normalizeLoadedSession(rawSession, {
    validQuestionIds: new Set(state.questions.map((question) => question.id)),
  });
  if (!session) {
    if (rawSession !== null) {
      clearSession();
    }
    return null;
  }

  return session;
}

function getStoredSelectedLabel(questionId, choices, choiceMap = null) {
  return getStoredSelectedLabelFromSession(state.session, questionId, choices, choiceMap);
}

function persistSession() {
  if (!state.session) return;
  state.session.savedAt = new Date().toISOString();
  saveActiveSession(state.session);
}

function clearSession() {
  clearActiveSession();
}

function showView(name) {
  closeSecondaryActions({ forceDesktopState: true });
  switchView(els.views, name);
}

function saveSettingsFromUI() {
  const result = readSettingsFromUI(els);
  if (!result.ok) {
    els.homeMessage.textContent = result.message;
    return false;
  }

  state.settings = result.settings;
  saveSettings(state.settings);
  return true;
}

function updateBookmarkLabel(bookmarkEnabled) {
  els.bookmarkBtn.textContent = bookmarkEnabled ? 'ブックマーク★' : 'ブックマーク☆';
}
