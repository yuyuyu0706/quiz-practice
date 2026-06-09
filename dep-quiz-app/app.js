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
import {
  baseProgress,
  hasNote,
  saveNote,
  deleteNote,
  deleteAllNotes,
  getAllNoteItems,
} from './notes.js';
import { loadQuestions } from './questions.js';
import {
  createQuizSession,
  createSession,
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
  renderNotesList as renderNotesListView,
  formatDateTime,
  renderQuestion as renderQuestionView,
  renderResult,
  toggleNoteEditor,
  renderStorageRepairNotice,
} from './render.js';

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
    notes: document.getElementById('notes-view'),
  },
  form: document.getElementById('settings-form'),
  sectionCheckboxes: document.getElementById('section-checkboxes'),
  questionCount: document.getElementById('question-count'),
  resumeBtn: document.getElementById('resume-btn'),
  discardSessionBtn: document.getElementById('discard-session-btn'),
  reviewNotesBtn: document.getElementById('review-notes-btn'),
  notesListBtn: document.getElementById('notes-list-btn'),
  notesList: document.getElementById('notes-list'),
  notesEmpty: document.getElementById('notes-empty'),
  deleteAllNotes: document.getElementById('delete-all-notes'),
  notesBackHome: document.getElementById('notes-back-home'),
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
  noteStatus: document.getElementById('note-status'),
  bookmarkBtn: document.getElementById('bookmark-btn'),
  suspendToHome: document.getElementById('suspend-to-home'),
  scoreText: document.getElementById('score-text'),
  sectionScoreText: document.getElementById('section-score-text'),
  wrongList: document.getElementById('wrong-list'),
  retryWrong: document.getElementById('retry-wrong'),
  resultNotesListBtn: document.getElementById('result-notes-list-btn'),
  backHome: document.getElementById('back-home'),
};

let noteStatusTimer = null;

init();

async function init() {
  state.questions = await loadQuestions();
  buildSectionCheckboxes();
  hydrateSettingsUI();
  attachEvents();
  syncSecondaryActionLayout();
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
  els.reviewNotesBtn?.addEventListener('click', () => {
    const ok = saveScopeSettingsFromUI();
    if (ok) startSession('notesOnly');
  });
  els.notesListBtn?.addEventListener('click', () => {
    renderNotesList();
    showView('notes');
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
    setSecondaryActionsOpen(!expanded);
  });

  els.choicesForm.addEventListener('change', handleChoiceSelectionChange);

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
    const current = state.progress[q.id] ?? baseProgress();
    current.bookmark = !current.bookmark;
    state.progress[q.id] = current;
    saveProgress(state.progress);
    updateBookmarkLabel(current.bookmark);
  });
  els.saveNote.addEventListener('click', saveCurrentQuestionNote);

  els.retryWrong.addEventListener('click', () => startSession('wrongOnly'));
  els.resultNotesListBtn?.addEventListener('click', () => {
    renderNotesList();
    showView('notes');
  });
  els.backHome.addEventListener('click', () => {
    showView('home');
    refreshResumeUI();
  });
  els.notesBackHome?.addEventListener('click', () => {
    showView('home');
  });
  els.deleteAllNotes?.addEventListener('click', handleDeleteAllNotes);

  els.suspendToHome.addEventListener('click', () => {
    if (!state.session) return;
    closeSecondaryActions();
    persistSession();
    showView('home');
    els.homeMessage.textContent = '中断状態を保存しました。';
    refreshResumeUI();
  });

  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('resize', handleViewportChange);
}

function handleDocumentClick(event) {
  if (!isMobileViewport()) return;
  const secondaryGroup = els.secondaryActionsToggle?.closest('.button-group-secondary');
  if (!secondaryGroup || secondaryGroup.contains(event.target)) return;
  closeSecondaryActions();
}

function handleViewportChange() {
  syncSecondaryActionLayout();
  if (!isMobileViewport()) {
    closeSecondaryActions({ forceDesktopState: true });
  }
}

function syncSecondaryActionLayout() {
  const targetSlot = isMobileViewport() ? els.suspendMobileSlot : els.suspendDesktopSlot;
  if (!targetSlot || !els.suspendToHome || targetSlot.contains(els.suspendToHome)) return;
  targetSlot.appendChild(els.suspendToHome);
}

function setSecondaryActionsOpen(isOpen) {
  const secondaryGroup = els.secondaryActionsToggle?.closest('.button-group-secondary');
  if (!els.secondaryActionsToggle || !secondaryGroup) return;
  const shouldOpen = Boolean(isOpen) && isMobileViewport();
  secondaryGroup.classList.toggle('is-open', shouldOpen);
  els.secondaryActionsToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function closeSecondaryActions(options = {}) {
  const { forceDesktopState = false } = options;
  if (!isMobileViewport() && !forceDesktopState) return;
  setSecondaryActionsOpen(false);
}

function handleKeyboard(event) {
  if (!state.session || els.views.quiz.className.indexOf('active') === -1) return;
  if (isTextEntryTarget(event.target)) return;
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

function isTextEntryTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('textarea, input, select')) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return false;
}

function startSession(forcedMode = null) {
  const mode = forcedMode ?? state.settings.mode;
  let { pool, session } = createQuizSession(
    state.questions,
    state.settings,
    mode,
    state.progress,
    hasNote
  );

  if (!pool.length) {
    els.homeMessage.textContent =
      mode === 'notesOnly'
        ? 'メモが登録された問題がありません。解答後にメモを保存すると、この復習を利用できます。'
        : '対象となる問題がありません。設定を変更してください。';
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
  if (scrollToTop) scrollQuizIntoView();
}

function submitCurrentAnswer(event) {
  event?.preventDefault?.();
  const question = getCurrentQuestion();
  if (!question || state.session?.graded?.[question.id]) {
    updatePrimaryActions(question?.id);
    return;
  }

  const selected = els.choicesForm.querySelector('input[name="choice"]:checked');
  if (!selected) {
    els.quizMessage.textContent = '選択肢を1つ選んでから「回答する」を押してください。';
    els.choicesForm.classList.add('needs-selection');
    els.selectionHint.textContent = '未選択です。まずは選択肢をタップしてください。';
    scrollChoiceGroupIntoView();
    return;
  }

  els.choicesForm.classList.remove('needs-selection');

  const selectedLabel = selected.value;
  const choiceMap = getOrCreateChoiceMap(state.session, question.id, question.choices);
  state.session.answers[question.id] = selectedLabel;
  state.session.graded[question.id] = true;
  state.session.explanationOpen = true;

  const correct = gradeAnswer(question, selectedLabel, choiceMap);
  const currentProgress = state.progress[question.id] ?? baseProgress();
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

function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function scrollQuizIntoView() {
  const target = els.quizTopAnchor ?? els.views.quiz;
  if (!target) return;

  if (isMobileViewport()) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function scrollChoiceGroupIntoView() {
  if (!isMobileViewport()) return;
  els.choicesForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const session = normalizeLoadedSession(rawSession);
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

function buildSectionCheckboxes() {
  const sectionMap = new Map();
  state.questions.forEach((question) => {
    if (!sectionMap.has(question.section)) {
      sectionMap.set(question.section, question.sectionTitle ?? '');
    }
  });

  const sections = Array.from(sectionMap.entries()).sort(
    ([sectionA], [sectionB]) => Number(sectionA) - Number(sectionB)
  );

  els.sectionCheckboxes.innerHTML = sections
    .map(
      ([section, sectionTitle]) =>
        `<label><input type="checkbox" name="sections" value="${section}" checked /><span class="section-label"><span class="section-number">Section ${section}</span><span class="section-title">${sectionTitle}</span></span></label>`
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
  const sections = Array.from(els.sectionCheckboxes.querySelectorAll('input:checked')).map(
    (input) => input.value
  );
  if (!sections.length) {
    els.homeMessage.textContent = '最低1つのセクションを選択してください。';
    return false;
  }
  state.settings = {
    sections,
    mode: els.form.querySelector('input[name="mode"]:checked').value,
    count: els.questionCount.value,
  };
  saveSettings(state.settings);
  return true;
}

function saveScopeSettingsFromUI() {
  const sections = Array.from(els.sectionCheckboxes.querySelectorAll('input:checked')).map(
    (input) => input.value
  );
  if (!sections.length) {
    els.homeMessage.textContent = '最低1つのセクションを選択してください。';
    return false;
  }

  state.settings = {
    ...state.settings,
    sections,
    count: els.questionCount.value,
  };
  saveSettings(state.settings);
  return true;
}

function updateBookmarkLabel(bookmarkEnabled) {
  els.bookmarkBtn.textContent = bookmarkEnabled ? 'ブックマーク★' : 'ブックマーク☆';
}

function saveCurrentQuestionNote() {
  const question = getCurrentQuestion();
  if (!question) return;
  state.progress = saveNote(state.progress, question.id, els.questionNote.value);
  saveProgress(state.progress);
  const noteText = state.progress[question.id]?.noteText?.trim();
  updateNoteStatus(noteText ? 'メモを保存しました。' : 'メモを空にしました。');
}

function renderQuestionNote(questionId) {
  const graded = Boolean(state.session?.graded?.[questionId]);
  const progress = state.progress[questionId] ?? {};

  els.notePanel.classList.toggle('hidden', !graded);
  els.questionNote.value = progress.noteText ?? '';
  els.noteStatus.textContent = progress.noteUpdatedAt
    ? `最終保存: ${formatDateTime(progress.noteUpdatedAt)}`
    : '';
}

function renderNotesList() {
  const noteItems = getAllNoteItems(state.questions, state.progress);
  renderNotesListView(els, noteItems, {
    onSolve: startSingleQuestionSession,
    onEdit: handleToggleNoteEdit,
    onDelete: handleDeleteNote,
  });
}

function startSingleQuestionSession(questionId) {
  state.session = createSession([questionId], 'single', {
    ...state.settings,
    mode: 'single',
  });
  persistSession();
  showView('quiz');
  renderQuestion({ scrollToTop: true });
}

function handleToggleNoteEdit(card, questionId) {
  const currentNote = state.progress[questionId]?.noteText ?? '';
  toggleNoteEditor(card, currentNote, (noteText) => {
    state.progress = saveNote(state.progress, questionId, noteText);
    saveProgress(state.progress);
    renderNotesList();
  });
}

function handleDeleteNote(questionId) {
  if (!window.confirm('このメモを削除しますか？')) return;
  state.progress = deleteNote(state.progress, questionId);
  saveProgress(state.progress);
  renderNotesList();
}

function handleDeleteAllNotes() {
  if (!window.confirm('メモをすべて削除しますか？')) return;
  state.progress = deleteAllNotes(state.progress);
  saveProgress(state.progress);
  renderNotesList();
}

function updateNoteStatus(message) {
  els.noteStatus.textContent = message;
  if (noteStatusTimer) window.clearTimeout(noteStatusTimer);
  noteStatusTimer = window.setTimeout(() => {
    const question = getCurrentQuestion();
    if (!question) return;
    renderQuestionNote(question.id);
  }, 1800);
}
