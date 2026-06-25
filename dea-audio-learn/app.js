const domainList = document.querySelector('#domain-list');
const chapterList = document.querySelector('#chapter-list');
const sectionSelector = document.querySelector('#section-selector');
const chapterSelector = document.querySelector('#chapter-selector');
const audioTocPanel = document.querySelector('#audio-toc-panel');
const sidebarSectionCurrent = document.querySelector('#sidebar-section-current');
const sidebarChapterCurrent = document.querySelector('#sidebar-chapter-current');
const sidebarTocCurrent = document.querySelector('#sidebar-toc-current');
const selectedDomain = document.querySelector('#selected-domain');
const selectedTitle = document.querySelector('#selected-chapter-title');
const selectedMinutes = document.querySelector('#selected-minutes');
const selectedStatus = document.querySelector('#selected-status');
const selectedChapterProgress = document.querySelector('#selected-chapter-progress');
const previousChapterButton = document.querySelector('#previous-chapter');
const nextChapterButton = document.querySelector('#next-chapter');
const audioScriptMarkdown = document.querySelector('#audio-script-markdown');
const audioTocList = document.querySelector('#audio-toc-list');
const noteMarkdown = document.querySelector('#note-markdown');
const speechPreviousButton = document.querySelector('#speech-previous');
const speechToggleButton = document.querySelector('#speech-toggle');
const speechNextButton = document.querySelector('#speech-next');
const speechRateSelect = document.querySelector('#speech-rate');
const speechStatus = document.querySelector('#speech-status');
const speechMessage = document.querySelector('#speech-message');
const speechCurrentPosition = document.querySelector('#speech-current-position');
const speechProgressLabel = document.querySelector('#speech-progress-label');
const speechProgressBar = document.querySelector('#speech-progress-bar');
const trackerSpeechPosition = document.querySelector('#tracker-speech-position');
const trackerSpeechStatus = document.querySelector('#tracker-speech-status');
const trackerSpeechToggleButton = document.querySelector('#tracker-speech-toggle');
const miniQuizList = document.querySelector('#mini-quiz-list');
const miniQuizSummary = document.querySelector('#mini-quiz-summary');
const learningTracker = document.querySelector('.learning-tracker');
const learningTrackerCurrent = document.querySelector('#learning-tracker-current');
const learningTrackerItems = Array.from(document.querySelectorAll('.learning-tracker__item'));
const learningTrackerButtons = Array.from(document.querySelectorAll('[data-stage-target]'));
const learningStageSections = Array.from(document.querySelectorAll('[data-learning-stage]'));

let chapters = [];
let quizzes = [];
let shuffledChoicesByQuestionId = new Map();
let selectedChapterIndex = 0;
let selectedDomainName = '';
let currentLearningStage = 'audio';
let highestReachedLearningStageIndex = 0;
let learningStageObserver = null;
let learningStageRafId = null;
const learningStages = [
  { key: 'audio', label: '音声教材', sectionId: 'audio-material-section' },
  { key: 'note', label: '要点メモ', sectionId: 'note-section' },
  { key: 'quiz', label: 'ミニクイズ', sectionId: 'mini-quiz-section' },
];
let currentAudioScriptText = '';
let speechSections = [];
let speechChunks = [];
let currentChunkIndex = 0;
let speechState = 'idle';
let activeUtterance = null;
let speechRunId = 0;
let lastSpeechResetReason = 'initial';
let availableSpeechVoices = [];
let selectedSpeechVoice = null;
let speechStartWatchdogId = null;
const speechStartWatchdogMs = 3000;
const maxSpeechChunkLength = 320;

const scrollToChapterStart = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'auto',
  });
};

const updateLearningTrackerScrollOffset = () => {
  const trackerRect = learningTracker.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(learningTracker);
  const stickyTop = Number.parseFloat(computedStyle.top) || 0;
  const safetyGap = 16;
  const offset = Math.ceil(trackerRect.height + stickyTop + safetyGap);
  document.documentElement.style.setProperty('--learning-tracker-scroll-offset', `${offset}px`);
  return offset;
};

const getLearningStageIndex = (stageKey) =>
  learningStages.findIndex((stage) => stage.key === stageKey);

const updateLearningTrackerUI = () => {
  const currentStage =
    learningStages.find((stage) => stage.key === currentLearningStage) ?? learningStages[0];
  learningTrackerCurrent.textContent = `現在：${currentStage.label}`;
  if (sidebarTocCurrent) {
    sidebarTocCurrent.textContent = `現在位置：${currentStage.label}`;
  }

  learningTrackerItems.forEach((item) => {
    const stageKey = item.dataset.stage;
    const stageIndex = getLearningStageIndex(stageKey);
    const isCurrent = stageKey === currentLearningStage;
    const isReached = stageIndex <= highestReachedLearningStageIndex;
    const status = item.querySelector('.learning-tracker__status');

    item.classList.toggle('is-current', isCurrent);
    item.classList.toggle('is-reached', isReached && !isCurrent);
    item.classList.toggle('is-unreached', !isReached && !isCurrent);
    item.setAttribute('aria-current', isCurrent ? 'step' : 'false');
    status.textContent = isCurrent ? '現在位置' : isReached ? '到達済み' : '未到達';
  });
};

const setCurrentLearningStage = (stageKey) => {
  const stageIndex = getLearningStageIndex(stageKey);
  if (stageIndex === -1) return;
  currentLearningStage = stageKey;
  highestReachedLearningStageIndex = Math.max(highestReachedLearningStageIndex, stageIndex);
  updateLearningTrackerUI();
};

const resetLearningTracker = () => {
  currentLearningStage = 'audio';
  highestReachedLearningStageIndex = 0;
  updateLearningTrackerUI();
};

const getMostCentralLearningStage = () => {
  const viewportCenter = window.innerHeight / 2;
  return learningStageSections
    .map((section) => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = Math.min(Math.max(viewportCenter, rect.top), rect.bottom);
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      return {
        stageKey: section.dataset.learningStage,
        stageIndex: getLearningStageIndex(section.dataset.learningStage),
        distance: Math.abs(sectionCenter - viewportCenter),
        visibleHeight,
      };
    })
    .filter((candidate) => candidate.visibleHeight > 0)
    .sort((left, right) => left.distance - right.distance || left.stageIndex - right.stageIndex)[0];
};

const refreshLearningStageFromViewport = () => {
  learningStageRafId = null;
  const centralStage = getMostCentralLearningStage();
  if (!centralStage) return;
  setCurrentLearningStage(centralStage.stageKey);
};

const queueLearningStageRefresh = () => {
  if (learningStageRafId !== null) return;
  learningStageRafId = window.requestAnimationFrame(refreshLearningStageFromViewport);
};

const setupLearningStageObserver = () => {
  if (learningStageObserver) learningStageObserver.disconnect();
  updateLearningTrackerScrollOffset();
  if (!('IntersectionObserver' in window)) {
    window.addEventListener('scroll', queueLearningStageRefresh, { passive: true });
    window.addEventListener('resize', () => {
      updateLearningTrackerScrollOffset();
      queueLearningStageRefresh();
    });
    return;
  }

  learningStageObserver = new IntersectionObserver(queueLearningStageRefresh, {
    root: null,
    threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
  });
  learningStageSections.forEach((section) => learningStageObserver.observe(section));
  window.addEventListener('resize', () => {
    updateLearningTrackerScrollOffset();
    queueLearningStageRefresh();
  });
};

const scrollToLearningStage = (stageKey) => {
  const stage = learningStages.find((candidate) => candidate.key === stageKey);
  const section = stage ? document.getElementById(stage.sectionId) : null;
  if (!section) return;
  if (section instanceof HTMLDetailsElement) section.open = true;
  const scrollOffset = updateLearningTrackerScrollOffset();
  setCurrentLearningStage(stageKey);
  const targetTop = window.scrollY + section.getBoundingClientRect().top - scrollOffset;
  window.scrollTo({
    top: Math.max(0, targetTop),
    left: 0,
    behavior: 'auto',
  });
};

const speechLogPrefix = '[DEA Audio Learn][Speech]';

const logSpeech = (message, detail) => {
  if (detail === undefined) {
    console.log(`${speechLogPrefix} ${message}`);
    return;
  }
  console.log(`${speechLogPrefix} ${message}`, detail);
};

const logSpeechError = (message, detail) => {
  if (detail === undefined) {
    console.error(`${speechLogPrefix} ${message}`);
    return;
  }
  console.error(`${speechLogPrefix} ${message}`, detail);
};

const speechStatusLabels = {
  idle: '未再生',
  starting: '読み上げ準備中',
  uncertain: '読み上げ確認中',
  speaking: '読み上げ中',
  paused: '一時停止中',
  ended: '読み上げ完了',
  error: '読み上げエラー',
  noVoices: '利用不可',
  unsupported: '利用不可',
};

const speechButtonLabels = {
  idle: '再生',
  starting: '準備中',
  uncertain: '再試行',
  speaking: '一時停止',
  paused: '再開',
  ended: '最初から再生',
  error: '再生',
  noVoices: '利用不可',
  unsupported: '利用不可',
};

const trackerSpeechButtonLabels = {
  ...speechButtonLabels,
  ended: '再生',
};

const speechUnavailableMessage =
  'このブラウザまたはOS環境では、利用可能な読み上げ音声が見つかりません。Chromeなど別のブラウザでお試しください。';
const noVoicesMessage = speechUnavailableMessage;

const getSpeechSupport = () => ({
  speechSynthesis: 'speechSynthesis' in window && Boolean(window.speechSynthesis),
  SpeechSynthesisUtterance:
    'SpeechSynthesisUtterance' in window && Boolean(window.SpeechSynthesisUtterance),
});

const isSpeechSupported = () => {
  const support = getSpeechSupport();
  return support.speechSynthesis && support.SpeechSynthesisUtterance;
};

const describeVoice = (voice) => ({
  name: voice.name,
  lang: voice.lang,
  default: voice.default,
  localService: voice.localService,
  voiceURI: voice.voiceURI,
});

const getAvailableSpeechVoices = () => {
  if (!getSpeechSupport().speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
};

const chooseSpeechVoice = (voices) => {
  const japaneseVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('ja'));
  if (japaneseVoice) return japaneseVoice;

  const defaultVoice = voices.find((voice) => voice.default);
  return defaultVoice ?? voices[0] ?? null;
};

const logSpeechSupport = () => {
  const support = getSpeechSupport();
  logSpeech('Web Speech API support', {
    windowSpeechSynthesis: window.speechSynthesis,
    windowSpeechSynthesisAvailable: support.speechSynthesis,
    windowSpeechSynthesisUtterance: window.SpeechSynthesisUtterance,
    windowSpeechSynthesisUtteranceAvailable: support.SpeechSynthesisUtterance,
  });

  if (support.speechSynthesis) {
    const voices = getAvailableSpeechVoices();
    logSpeech('speechSynthesis.getVoices()', {
      count: voices.length,
      voices: voices.map(describeVoice),
    });
  }
};

const refreshSpeechVoices = (reason) => {
  if (!isSpeechSupported()) {
    availableSpeechVoices = [];
    selectedSpeechVoice = null;
    setSpeechState('unsupported');
    return false;
  }

  availableSpeechVoices = getAvailableSpeechVoices();
  selectedSpeechVoice = chooseSpeechVoice(availableSpeechVoices);
  logSpeech('voice availability checked', {
    reason,
    count: availableSpeechVoices.length,
    selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
    voices: availableSpeechVoices.map(describeVoice),
  });

  if (availableSpeechVoices.length === 0) {
    showSpeechNoVoices();
    return false;
  }

  if (speechState === 'noVoices' || speechState === 'unsupported') {
    setSpeechState('idle');
  } else {
    updateSpeechUI();
  }
  return true;
};

const showSpeechError = (message) => {
  speechMessage.hidden = false;
  speechMessage.textContent = message;
  setSpeechState('error');
};

const showSpeechNoVoices = () => {
  speechMessage.hidden = false;
  speechMessage.textContent = noVoicesMessage;
  setSpeechState('noVoices');
};

const getSpeechSynthesisStateSnapshot = (runId) => ({
  runId,
  currentSpeechRunId: speechRunId,
  speechState,
  hasActiveUtterance: Boolean(activeUtterance),
  pending: window.speechSynthesis?.pending ?? false,
  speaking: window.speechSynthesis?.speaking ?? false,
  paused: window.speechSynthesis?.paused ?? false,
});

const clearSpeechStartWatchdog = () => {
  if (speechStartWatchdogId === null) return;
  window.clearTimeout(speechStartWatchdogId);
  speechStartWatchdogId = null;
};

const removeAudioScriptTitle = (markdown) =>
  markdown.replace(/^#\s*音声スクリプト:[^\n]*(?:\r?\n)+/u, '').trimStart();

const removeNoteTitle = (markdown) =>
  markdown.replace(/^#\s*要点メモ:[^\n]*(?:\r?\n)+/u, '').trimStart();

const stripMarkdownForSpeech = (markdown) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, ' ')
    .replace(/\|/g, '、')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const splitLongSpeechPart = (part, maxLength = maxSpeechChunkLength) => {
  const chunks = [];
  let remaining = part.trim();

  while (remaining.length > maxLength) {
    const windowText = remaining.slice(0, maxLength);
    const splitAt =
      Math.max(
        windowText.lastIndexOf('。'),
        windowText.lastIndexOf('！'),
        windowText.lastIndexOf('？'),
        windowText.lastIndexOf('、'),
        windowText.lastIndexOf('\n')
      ) + 1;
    const safeSplitAt = splitAt > Math.floor(maxLength * 0.45) ? splitAt : maxLength;
    chunks.push(remaining.slice(0, safeSplitAt).trim());
    remaining = remaining.slice(safeSplitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
};

const splitSpeechTextIntoChunks = (text, maxLength = maxSpeechChunkLength) => {
  const parts = text
    .split(/(?<=[。！？!?])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => splitLongSpeechPart(part, maxLength));

  const chunks = [];
  let currentChunk = '';

  parts.forEach((part) => {
    if (!currentChunk) {
      currentChunk = part;
      return;
    }

    if (`${currentChunk}\n${part}`.length <= maxLength) {
      currentChunk = `${currentChunk}\n${part}`;
      return;
    }

    chunks.push(currentChunk);
    currentChunk = part;
  });

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};

const getChunkSectionLabel = (chunkIndex) => {
  const chunk = speechChunks[chunkIndex];
  return chunk?.sectionTitle ?? '未再生';
};

const buildSpeechSectionsFromRenderedMarkdown = () => {
  const headings = Array.from(audioScriptMarkdown.querySelectorAll('h2, h3'));
  return headings
    .map((heading, index) => {
      const parts = [];
      let node = heading.nextElementSibling;
      while (node && !['H2', 'H3'].includes(node.tagName)) {
        if (!node.matches('pre, table')) {
          const clone = node.cloneNode(true);
          clone
            .querySelectorAll?.('pre, table, code.language-mermaid')
            .forEach((excluded) => excluded.remove());
          const text = clone.textContent?.trim();
          if (text) parts.push(text);
        }
        node = node.nextElementSibling;
      }

      const headingTitle = heading.dataset.speechTitle || heading.textContent?.trim() || '';
      const text = stripMarkdownForSpeech(`${headingTitle}\n${parts.join('\n')}`);
      const chunks = splitSpeechTextIntoChunks(text).map((chunkText, chunkOffset) => ({
        text: chunkText,
        sectionIndex: index,
        sectionTitle: headingTitle || `区切り ${index + 1}`,
        headingId: heading.id,
        chunkOffset,
      }));

      return {
        title: headingTitle || `区切り ${index + 1}`,
        headingId: heading.id,
        text,
        chunks,
      };
    })
    .filter((section) => section.chunks.length > 0);
};

const rebuildSpeechChunksFromSections = () => {
  speechChunks = speechSections.flatMap((section) => section.chunks);
  currentChunkIndex = Math.min(currentChunkIndex, Math.max(speechChunks.length - 1, 0));
};

const getActiveSpeechHeadingId = () =>
  ['starting', 'uncertain', 'speaking', 'paused', 'ended'].includes(speechState)
    ? speechChunks[currentChunkIndex]?.headingId
    : null;

const updateActiveHeadingPlayButtons = () => {
  const activeHeadingId = getActiveSpeechHeadingId();
  audioScriptMarkdown.querySelectorAll('.audio-heading-play').forEach((button) => {
    const isCurrent = activeHeadingId ? button.dataset.headingId === activeHeadingId : false;
    button.classList.toggle('is-current', isCurrent);
    button.setAttribute('aria-pressed', String(isCurrent));
  });
};

const updateActiveAudioTocItem = () => {
  const activeHeadingId = getActiveSpeechHeadingId();

  audioTocList.querySelectorAll('a[href^="#"]').forEach((link) => {
    const isCurrent = activeHeadingId ? link.getAttribute('href') === `#${activeHeadingId}` : false;
    link.parentElement?.classList.toggle('is-current', isCurrent);
    if (isCurrent) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  updateActiveHeadingPlayButtons();
};

const updateSpeechProgressUI = () => {
  const totalChunks = speechChunks.length;
  const hasProgress =
    totalChunks > 0 &&
    ['starting', 'uncertain', 'speaking', 'paused', 'ended'].includes(speechState);
  const displayIndex = hasProgress ? Math.min(currentChunkIndex + 1, totalChunks) : 0;
  const sectionLabel = hasProgress ? getChunkSectionLabel(currentChunkIndex) : '未再生';
  speechCurrentPosition.textContent = `現在：${sectionLabel}`;
  speechProgressLabel.textContent = `進捗：${displayIndex} / ${totalChunks} 区切り`;
  trackerSpeechPosition.textContent = `${sectionLabel} | ${displayIndex} / ${totalChunks} 区切り`;
  speechProgressBar.max = String(Math.max(totalChunks, 1));
  speechProgressBar.value = displayIndex;
  speechProgressBar.textContent = `${totalChunks === 0 ? 0 : Math.round((displayIndex / totalChunks) * 100)}%`;
  updateActiveAudioTocItem();

  const canMove =
    totalChunks > 0 &&
    ['starting', 'uncertain', 'speaking', 'paused', 'ended'].includes(speechState);
  const isPreviousDisabled = !canMove || currentChunkIndex <= 0;
  const isNextDisabled = !canMove || currentChunkIndex >= totalChunks - 1;
  speechPreviousButton.disabled = isPreviousDisabled;
  speechNextButton.disabled = isNextDisabled;
  speechPreviousButton.setAttribute('aria-disabled', String(isPreviousDisabled));
  speechNextButton.setAttribute('aria-disabled', String(isNextDisabled));
};

const updateSpeechUI = () => {
  const unavailable = speechState === 'unsupported' || speechState === 'noVoices';
  speechToggleButton.textContent = speechButtonLabels[speechState];
  trackerSpeechToggleButton.textContent = trackerSpeechButtonLabels[speechState];
  trackerSpeechToggleButton.setAttribute('aria-label', trackerSpeechButtonLabels[speechState]);
  const isToggleDisabled = unavailable || speechState === 'starting' || !currentAudioScriptText;
  speechToggleButton.disabled = isToggleDisabled;
  trackerSpeechToggleButton.disabled = isToggleDisabled;
  speechRateSelect.disabled = unavailable;
  speechStatus.textContent = speechStatusLabels[speechState];
  trackerSpeechStatus.textContent = speechStatusLabels[speechState];
  updateSpeechProgressUI();
  if (speechState === 'unsupported') {
    speechMessage.hidden = false;
    speechMessage.textContent =
      'このブラウザでは読み上げ機能に対応していません。対応ブラウザでお試しください。';
  } else if (speechState === 'noVoices') {
    speechMessage.hidden = false;
    speechMessage.textContent = noVoicesMessage;
  } else if (speechState === 'uncertain') {
    speechMessage.hidden = false;
  } else if (speechState !== 'error') {
    speechMessage.hidden = true;
    speechMessage.textContent = '';
  }
};

const setSpeechState = (nextState) => {
  speechState = nextState;
  updateSpeechUI();
};

const resetSpeechForChapterChange = () => {
  currentAudioScriptText = '';
  speechSections = [];
  speechChunks = [];
  currentChunkIndex = 0;
  const canUseSpeechApi = isSpeechSupported();
  const hasVoices = refreshSpeechVoices('chapter-change');

  speechRunId += 1;
  lastSpeechResetReason = 'chapter-change';
  clearSpeechStartWatchdog();
  if (canUseSpeechApi) {
    logSpeech('resetSpeechForChapterChange: calling speechSynthesis.cancel()', { speechRunId });
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (hasVoices) setSpeechState('idle');
};

const handleSpeechStartWatchdog = (runId, utterance, chunkIndex, utteranceStarted) => {
  speechStartWatchdogId = window.setTimeout(() => {
    speechStartWatchdogId = null;
    if (
      utteranceStarted() ||
      runId !== speechRunId ||
      activeUtterance !== utterance ||
      chunkIndex !== currentChunkIndex
    ) {
      return;
    }

    const speechSnapshot = {
      ...getSpeechSynthesisStateSnapshot(runId),
      chunkIndex,
      chunkCount: speechChunks.length,
      textLength: utterance.text.length,
      selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
    };
    logSpeechError('SpeechSynthesisUtterance chunk onstart watchdog timed out', speechSnapshot);

    if (speechSnapshot.speaking || speechSnapshot.pending || speechSnapshot.paused) {
      logSpeech(
        'watchdog found speechSynthesis active without chunk onstart; showing retry guidance',
        {
          ...speechSnapshot,
          lastSpeechResetReason,
        }
      );
      speechMessage.textContent =
        'ブラウザは読み上げ中と判定しています。音が出ない場合は「再試行」を押してください。';
      setSpeechState('uncertain');
      return;
    }

    activeUtterance = null;
    showSpeechError(
      '読み上げを開始できませんでした。ブラウザの読み上げ状態を確認してから、もう一度「再生」を押してください。'
    );
  }, speechStartWatchdogMs);
};

const speakChunk = (runId, chunkIndex) => {
  if (runId !== speechRunId || chunkIndex >= speechChunks.length) return;

  currentChunkIndex = chunkIndex;
  const chunkText = speechChunks[chunkIndex].text ?? speechChunks[chunkIndex];
  const utterance = new SpeechSynthesisUtterance(chunkText);
  let utteranceStarted = false;
  utterance.lang = 'ja-JP';
  utterance.rate = Number(speechRateSelect.value);

  utterance.onstart = (event) => {
    logSpeech('SpeechSynthesisUtterance chunk onstart', {
      runId,
      chunkIndex,
      chunkCount: speechChunks.length,
      textLength: chunkText.length,
      event,
    });
    if (runId !== speechRunId || activeUtterance !== utterance) return;
    utteranceStarted = true;
    clearSpeechStartWatchdog();
    setSpeechState('speaking');
  };
  utterance.onpause = (event) => {
    logSpeech('SpeechSynthesisUtterance chunk onpause', { runId, chunkIndex, event });
  };
  utterance.onresume = (event) => {
    logSpeech('SpeechSynthesisUtterance chunk onresume', { runId, chunkIndex, event });
  };
  utterance.onend = (event) => {
    logSpeech('SpeechSynthesisUtterance chunk onend', {
      runId,
      currentSpeechRunId: speechRunId,
      chunkIndex,
      chunkCount: speechChunks.length,
      lastSpeechResetReason,
      event,
    });
    if (runId !== speechRunId || activeUtterance !== utterance) return;
    clearSpeechStartWatchdog();

    if (chunkIndex + 1 < speechChunks.length) {
      speakChunk(runId, chunkIndex + 1);
      return;
    }

    activeUtterance = null;
    setSpeechState('ended');
  };
  utterance.onerror = (event) => {
    const voices = getAvailableSpeechVoices();
    logSpeechError('SpeechSynthesisUtterance chunk onerror', {
      runId,
      currentSpeechRunId: speechRunId,
      chunkIndex,
      chunkCount: speechChunks.length,
      lastSpeechResetReason,
      error: event.error,
      voicesCount: voices.length,
      selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
      utteranceLang: utterance.lang,
      utteranceRate: utterance.rate,
      textLength: utterance.text.length,
      event,
    });
    if (runId !== speechRunId || activeUtterance !== utterance) return;

    if (event.error === 'interrupted' && speechState === 'starting') {
      logSpeech('ignored interrupted error during speech queue reset', {
        ...getSpeechSynthesisStateSnapshot(runId),
        chunkIndex,
        error: event.error,
      });
      return;
    }

    clearSpeechStartWatchdog();
    activeUtterance = null;
    showSpeechError(`読み上げに失敗しました（${event.error}）。${speechUnavailableMessage}`);
  };

  activeUtterance = utterance;
  setSpeechState('starting');
  logSpeech('calling speechSynthesis.speak() directly for chunk', {
    runId,
    chunkIndex,
    chunkCount: speechChunks.length,
    rate: utterance.rate,
    lang: utterance.lang,
    textLength: utterance.text.length,
    voicesCount: availableSpeechVoices.length,
    selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
    voiceAssignment: 'lang-only',
    pending: window.speechSynthesis.pending,
    speaking: window.speechSynthesis.speaking,
    paused: window.speechSynthesis.paused,
  });
  window.speechSynthesis.speak(utterance);
  logSpeech('speechSynthesis state immediately after direct chunk speak()', {
    ...getSpeechSynthesisStateSnapshot(runId),
    chunkIndex,
    chunkCount: speechChunks.length,
  });
  if (utteranceStarted) return;

  handleSpeechStartWatchdog(runId, utterance, chunkIndex, () => utteranceStarted);
};

const speakFromStart = () => {
  logSpeech('play button handler started', { speechState, lastSpeechResetReason });
  logSpeechSupport();

  if (!refreshSpeechVoices('play-button')) return;
  if (!currentAudioScriptText) {
    const message =
      '読み上げ用テキストが空のため再生できません。音声スクリプトの読み込み状態を確認してください。';
    logSpeechError(message, {
      selectedChapterIndex,
      audioScriptMarkdownLength: audioScriptMarkdown.textContent.length,
    });
    showSpeechError(message);
    return;
  }

  logSpeech('speech text before utterance', {
    length: currentAudioScriptText.length,
    preview: currentAudioScriptText.slice(0, 200),
  });

  speechRunId += 1;
  const runId = speechRunId;
  rebuildSpeechChunksFromSections();
  currentChunkIndex = 0;
  if (speechChunks.length === 0) {
    showSpeechError(
      '読み上げ用テキストをチャンク分割できませんでした。音声スクリプトの内容を確認してください。'
    );
    return;
  }
  logSpeech('speech text split into chunks', {
    runId,
    chunkCount: speechChunks.length,
    chunkLengths: speechChunks.map((chunk) => (chunk.text ?? chunk).length),
    maxSpeechChunkLength,
  });

  lastSpeechResetReason = 'play-request';
  clearSpeechStartWatchdog();
  const beforeSpeakState = getSpeechSynthesisStateSnapshot(runId);
  if (
    beforeSpeakState.speaking ||
    beforeSpeakState.pending ||
    beforeSpeakState.paused ||
    speechState === 'uncertain' ||
    speechState === 'error' ||
    speechState === 'ended'
  ) {
    logSpeech('speakFromStart: clearing active speechSynthesis queue before direct speak()', {
      ...beforeSpeakState,
      selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
    });
    window.speechSynthesis.cancel();
  } else {
    logSpeech('speakFromStart: speechSynthesis queue is already clear before direct speak()', {
      ...beforeSpeakState,
      selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
    });
  }

  speakChunk(runId, 0);
};

const handleSpeechToggle = () => {
  if (speechState === 'speaking') {
    window.speechSynthesis.pause();
    setSpeechState('paused');
    return;
  }

  if (speechState === 'paused') {
    window.speechSynthesis.resume();
    setSpeechState('speaking');
    return;
  }

  if (
    speechState === 'idle' ||
    speechState === 'ended' ||
    speechState === 'error' ||
    speechState === 'uncertain'
  ) {
    speakFromStart();
  }
};

const jumpToSpeechChunk = (targetChunkIndex, options = {}) => {
  if (speechChunks.length === 0) rebuildSpeechChunksFromSections();
  if (speechChunks.length === 0) return;
  const safeChunkIndex = Math.min(Math.max(targetChunkIndex, 0), speechChunks.length - 1);
  const shouldResume =
    options.play === true ||
    ['speaking', 'starting', 'uncertain', 'paused', 'ended'].includes(speechState);
  currentChunkIndex = safeChunkIndex;
  if (!shouldResume) {
    updateSpeechUI();
    return;
  }

  speechRunId += 1;
  const runId = speechRunId;
  clearSpeechStartWatchdog();
  lastSpeechResetReason = 'chunk-navigation';
  window.speechSynthesis.cancel();
  speakChunk(runId, safeChunkIndex);
};

const restartCurrentChunkForRateChange = (previousSpeechState) => {
  if (!['speaking', 'paused', 'uncertain'].includes(previousSpeechState)) return false;
  if (speechChunks.length === 0) return false;

  const previousRunId = speechRunId;
  const restartChunkIndex = currentChunkIndex;
  speechRunId += 1;
  const runId = speechRunId;
  clearSpeechStartWatchdog();
  lastSpeechResetReason = 'rate-change';
  logSpeech('rate change restart current chunk', {
    runId,
    previousRunId,
    currentChunkIndex: restartChunkIndex,
    chunkCount: speechChunks.length,
    newRate: Number(speechRateSelect.value),
    previousSpeechState,
    ...getSpeechSynthesisStateSnapshot(runId),
  });
  window.speechSynthesis.cancel();
  speechMessage.textContent = '速度変更を現在の区切りから反映しました。';
  speechMessage.hidden = false;
  speakChunk(runId, restartChunkIndex);
  return true;
};

const sidebarMenus = [sectionSelector, chapterSelector, audioTocPanel].filter(Boolean);

const syncSidebarMenuExpandedState = (menu) => {
  const summary = menu.querySelector('summary');
  if (!summary) return;
  summary.setAttribute('aria-expanded', String(menu.open));
};

const setupSidebarMenus = () => {
  sidebarMenus.forEach((menu) => {
    syncSidebarMenuExpandedState(menu);
    menu.addEventListener('toggle', () => syncSidebarMenuExpandedState(menu));
  });
};

const syncChapterSelectorState = () => {
  if (sectionSelector) sectionSelector.open = false;
  chapterSelector.open = true;
  audioTocPanel.open = false;
  sidebarMenus.forEach(syncSidebarMenuExpandedState);
};

const renderMarkdown = (markdown) => {
  if (window.marked) {
    return window.marked.parse(markdown);
  }

  const escaped = markdown.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<pre>${escaped}</pre>`;
};

const normalizeHeadingId = (text, index) => {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `audio-heading-${normalized || index + 1}`;
};

const addExternalLinkAttributes = (root) => {
  root.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') ?? '';
    if (!/^https?:\/\//u.test(href)) return;

    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
};

const setActiveAudioTocLink = (href) => {
  audioTocList.querySelectorAll('a[href^="#"]').forEach((link) => {
    const isCurrent = link.getAttribute('href') === href;
    link.parentElement?.classList.toggle('is-current', isCurrent);
    if (isCurrent) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
  });
};

const appendAudioTocLink = (href, text, className = 'audio-toc__item') => {
  const item = document.createElement('li');
  item.className = className;

  const link = document.createElement('a');
  link.href = href;
  link.textContent = text;
  link.addEventListener('click', () => setActiveAudioTocLink(href));
  item.append(link);
  audioTocList.append(item);
};

const getFirstChunkIndexForHeading = (headingId) => {
  if (speechChunks.length === 0) rebuildSpeechChunksFromSections();
  return speechChunks.findIndex((chunk) => chunk.headingId === headingId);
};

const handleHeadingPlay = (headingId) => {
  if (!refreshSpeechVoices('heading-play-button')) return;
  const targetChunkIndex = getFirstChunkIndexForHeading(headingId);
  if (targetChunkIndex < 0) {
    showSpeechError('この見出しから再生できる読み上げ区切りが見つかりませんでした。');
    return;
  }
  jumpToSpeechChunk(targetChunkIndex, { play: true });
};

const addHeadingPlayButtons = () => {
  audioScriptMarkdown.querySelectorAll('.audio-heading-play').forEach((button) => button.remove());

  audioScriptMarkdown.querySelectorAll('h2, h3').forEach((heading) => {
    const headingTitle = heading.dataset.speechTitle || heading.textContent?.trim() || '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'audio-heading-play';
    button.dataset.headingId = heading.id;
    button.textContent = '再生';
    button.setAttribute('aria-label', `「${headingTitle}」から再生`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      handleHeadingPlay(heading.id);
    });
    heading.append(button);
  });
};

const buildAudioTableOfContents = () => {
  audioTocList.innerHTML = '';

  const headings = Array.from(audioScriptMarkdown.querySelectorAll('h2, h3'));
  const usedIds = new Set();
  headings.forEach((heading, index) => {
    const headingTitle = heading.dataset.speechTitle || heading.textContent?.trim() || '';
    heading.dataset.speechTitle = headingTitle;
    const baseHeadingId = normalizeHeadingId(headingTitle, index);
    let headingId = baseHeadingId;
    let suffix = 2;
    while (usedIds.has(headingId)) {
      headingId = `${baseHeadingId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(headingId);
    heading.id = headingId;

    appendAudioTocLink(
      `#${headingId}`,
      headingTitle,
      `audio-toc__item audio-toc__item--${heading.tagName.toLowerCase()}`
    );
  });

  addHeadingPlayButtons();
  updateActiveAudioTocItem();

  appendAudioTocLink('#note-title', '要点メモ', 'audio-toc__item audio-toc__item--page-section');
  appendAudioTocLink(
    '#mini-quiz-title',
    'ミニクイズ',
    'audio-toc__item audio-toc__item--page-section'
  );
};

const shuffleEntries = (entries) =>
  entries
    .map((entry) => ({ entry, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ entry }) => entry);

const getShuffledChoices = (question) => {
  if (!shuffledChoicesByQuestionId.has(question.id)) {
    shuffledChoicesByQuestionId.set(
      question.id,
      shuffleEntries(Object.entries(question.choices)).map(([key, text]) => ({ key, text }))
    );
  }
  return shuffledChoicesByQuestionId.get(question.id);
};

const renderQuizFeedback = (question, selectedChoiceKey, feedbackElement) => {
  if (!selectedChoiceKey) {
    feedbackElement.hidden = false;
    feedbackElement.className = 'quiz-feedback quiz-feedback--notice';
    feedbackElement.textContent = '選択肢を選んでから回答してください。';
    return;
  }

  const isCorrect = selectedChoiceKey === question.answer;
  const answerText = question.choices[question.answer];
  const wrongReason = !isCorrect ? question.whyWrong?.[selectedChoiceKey] : '';
  feedbackElement.hidden = false;
  feedbackElement.className = `quiz-feedback ${isCorrect ? 'quiz-feedback--correct' : 'quiz-feedback--incorrect'}`;
  feedbackElement.innerHTML = '';

  const result = document.createElement('p');
  result.className = 'quiz-feedback__result';
  result.textContent = isCorrect ? '正解です。' : `不正解です。正解は「${answerText}」です。`;
  feedbackElement.append(result);

  if (!isCorrect && wrongReason) {
    const reason = document.createElement('p');
    reason.textContent = `選んだ回答について：${wrongReason}`;
    feedbackElement.append(reason);
  }

  const explanation = document.createElement('p');
  explanation.textContent = `解説：${question.explanation}`;
  feedbackElement.append(explanation);

  if (question.references?.length > 0) {
    const references = document.createElement('div');
    references.className = 'quiz-references';
    const label = document.createElement('span');
    label.textContent = '参考リンク：';
    references.append(label);
    question.references.forEach((reference, index) => {
      if (index > 0) references.append(document.createTextNode(' / '));
      const link = document.createElement('a');
      link.href = reference.url;
      link.textContent = reference.title;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      references.append(link);
    });
    feedbackElement.append(references);
  }
};

const renderMiniQuizzes = (chapterId) => {
  const chapterQuizzes = quizzes.filter((quiz) => quiz.chapterId === chapterId);
  miniQuizList.innerHTML = '';
  miniQuizSummary.textContent = chapterQuizzes.length
    ? `${chapterQuizzes.length}問のミニクイズで、聞いた内容を思い出せるか確認します。`
    : 'このチャプターのミニクイズは準備中です。';

  if (chapterQuizzes.length === 0) {
    miniQuizList.textContent = 'このチャプターのミニクイズは準備中です。';
    return;
  }

  chapterQuizzes.forEach((question, index) => {
    const article = document.createElement('article');
    article.className = 'quiz-question';
    article.dataset.quizId = question.id;

    const title = document.createElement('h3');
    title.textContent = `Q${index + 1}. ${question.question}`;
    article.append(title);

    const choices = document.createElement('div');
    choices.className = 'quiz-choices';
    choices.setAttribute('role', 'radiogroup');
    choices.setAttribute('aria-label', `${question.id}の選択肢`);

    const displayLabels = ['A', 'B', 'C', 'D'];

    getShuffledChoices(question).forEach((choice, choiceIndex) => {
      const label = document.createElement('label');
      label.className = 'quiz-choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = question.id;
      input.value = choice.key;
      const text = document.createElement('span');
      text.textContent = `${displayLabels[choiceIndex]}. ${choice.text}`;
      label.append(input, text);
      choices.append(label);
    });
    article.append(choices);

    const answerButton = document.createElement('button');
    answerButton.type = 'button';
    answerButton.className = 'quiz-answer-button';
    answerButton.textContent = '回答する';
    article.append(answerButton);

    const feedback = document.createElement('div');
    feedback.className = 'quiz-feedback';
    feedback.hidden = true;
    article.append(feedback);

    answerButton.addEventListener('click', () => {
      const selected = article.querySelector(`input[name="${question.id}"]:checked`);
      renderQuizFeedback(question, selected?.value, feedback);
    });

    miniQuizList.append(article);
  });
};

const fetchText = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} の読み込みに失敗しました`);
  }
  return response.text();
};

const getDomains = () => [...new Set(chapters.map((chapter) => chapter.domain))];

const getChapterProgress = (chapterId) => {
  const chapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
  const chapter = chapters[chapterIndex];

  if (!chapter) {
    return null;
  }

  return {
    domain: chapter.domain,
    current: chapterIndex + 1,
    total: chapters.length,
    title: chapter.title,
  };
};

const renderChapterOverviewProgress = (chapterId) => {
  const progress = getChapterProgress(chapterId);
  const progressText = progress
    ? `Chapter ${progress.current} / ${progress.total}`
    : 'Chapter - / -';

  selectedChapterProgress.textContent = progressText;
  if (sidebarChapterCurrent) {
    sidebarChapterCurrent.textContent = progress?.title ?? '読み込み中...';
  }
  if (sidebarSectionCurrent) {
    sidebarSectionCurrent.textContent = progress?.domain ?? '読み込み中...';
  }
};

const getChaptersByDomain = (domain) =>
  chapters
    .filter((chapter) => chapter.domain === domain)
    .sort((left, right) => left.chapterNo - right.chapterNo);

const renderDomainList = () => {
  domainList.innerHTML = '';

  getDomains().forEach((domain, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'domain-button';
    button.dataset.domain = domain;

    const marker = document.createElement('span');
    marker.className = 'domain-button__marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = String(index + 1);

    const label = document.createElement('span');
    label.className = 'domain-button__label';
    label.textContent = domain;

    button.append(marker, label);
    button.addEventListener('click', () => selectDomain(domain));
    domainList.append(button);
  });
};

const renderChapterList = (domain = selectedDomainName) => {
  chapterList.innerHTML = '';
  const domainChapters = getChaptersByDomain(domain);

  if (domainChapters.length === 0) {
    chapterList.textContent = 'この領域のチャプターは準備中です。';
    return;
  }

  domainChapters.forEach((chapter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.dataset.chapterId = chapter.id;
    button.innerHTML = `
      <span>Chapter ${chapter.chapterNo}</span>
      <strong>${chapter.title}</strong>
    `;
    button.addEventListener('click', () => selectChapterById(chapter.id));
    chapterList.append(button);
  });
};

const updateActiveDomain = (domain) => {
  document.querySelectorAll('.domain-button').forEach((button) => {
    const isActive = button.dataset.domain === domain;
    button.classList.toggle('is-active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
};

const updateActiveChapter = (chapterId) => {
  document.querySelectorAll('.chapter-button').forEach((button) => {
    const isActive = button.dataset.chapterId === chapterId;
    button.classList.toggle('is-active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
};

const selectDomain = async (domain) => {
  const firstChapter = getChaptersByDomain(domain)[0];
  if (!firstChapter) return;
  await selectChapterById(firstChapter.id);
};

const updateChapterNavigation = () => {
  const isFirstChapter = selectedChapterIndex === 0;
  const isLastChapter = selectedChapterIndex === chapters.length - 1;

  previousChapterButton.disabled = isFirstChapter;
  nextChapterButton.disabled = isLastChapter;
  previousChapterButton.setAttribute('aria-disabled', String(isFirstChapter));
  nextChapterButton.setAttribute('aria-disabled', String(isLastChapter));
};

const selectChapterByIndex = async (chapterIndex) => {
  const chapter = chapters[chapterIndex];
  if (!chapter) {
    return;
  }

  resetSpeechForChapterChange();
  resetLearningTracker();
  updateLearningTrackerScrollOffset();
  selectedChapterIndex = chapterIndex;
  if (selectedDomainName !== chapter.domain) {
    selectedDomainName = chapter.domain;
    renderChapterList(chapter.domain);
  }
  updateActiveDomain(chapter.domain);
  updateActiveChapter(chapter.id);
  updateChapterNavigation();
  selectedDomain.textContent = chapter.domain;
  selectedTitle.textContent = chapter.title;
  selectedMinutes.textContent = `音声目安：約${chapter.estimatedMinutes}分`;
  selectedStatus.textContent = chapter.status;
  renderChapterOverviewProgress(chapter.id);
  audioScriptMarkdown.textContent = '音声スクリプトを読み込み中...';
  audioTocList.innerHTML = '';
  noteMarkdown.textContent = '要点メモを読み込み中...';
  renderMiniQuizzes(chapter.id);

  try {
    try {
      const audioScript = removeAudioScriptTitle(await fetchText(chapter.audioScriptPath));
      audioScriptMarkdown.innerHTML = renderMarkdown(audioScript);
      buildAudioTableOfContents();
      speechSections = buildSpeechSectionsFromRenderedMarkdown();
      rebuildSpeechChunksFromSections();
      currentAudioScriptText = speechChunks.map((chunk) => chunk.text).join('\n');
      updateSpeechUI();
      logSpeech('audio script loaded', {
        chapterId: chapter.id,
        markdownLength: audioScript.length,
        speechTextLength: currentAudioScriptText.length,
        speechTextPreview: currentAudioScriptText.slice(0, 200),
      });
      refreshSpeechVoices('audio-script-loaded');
    } catch (error) {
      audioScriptMarkdown.textContent = error.message;
    }

    try {
      const note = removeNoteTitle(await fetchText(chapter.notePath));
      noteMarkdown.innerHTML = renderMarkdown(note);
      addExternalLinkAttributes(noteMarkdown);
    } catch (error) {
      noteMarkdown.textContent = '要点メモの読み込みに失敗しました';
    }
  } finally {
    scrollToChapterStart();
  }
};

const selectChapterById = async (chapterId) => {
  const chapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
  await selectChapterByIndex(chapterIndex);
};

previousChapterButton.addEventListener('click', () => {
  selectChapterByIndex(selectedChapterIndex - 1);
});

nextChapterButton.addEventListener('click', () => {
  selectChapterByIndex(selectedChapterIndex + 1);
});

speechPreviousButton.addEventListener('click', () => jumpToSpeechChunk(currentChunkIndex - 1));
speechToggleButton.addEventListener('click', handleSpeechToggle);
trackerSpeechToggleButton.addEventListener('click', handleSpeechToggle);
speechNextButton.addEventListener('click', () => jumpToSpeechChunk(currentChunkIndex + 1));
learningTrackerButtons.forEach((button) => {
  button.addEventListener('click', () => scrollToLearningStage(button.dataset.stageTarget));
});
speechRateSelect.addEventListener('change', () => {
  const previousSpeechState = speechState;
  const newRate = Number(speechRateSelect.value);
  logSpeech('speech rate changed', {
    newRate,
    speechState,
    runId: speechRunId,
    currentSpeechRunId: speechRunId,
    currentChunkIndex,
    chunkCount: speechChunks.length,
    previousSpeechState,
    appliesTo:
      speechState === 'speaking' || speechState === 'paused' || speechState === 'uncertain'
        ? 'current chunk restart'
        : 'next utterance',
  });
  restartCurrentChunkForRateChange(previousSpeechState);
});

if (
  'speechSynthesis' in window &&
  window.speechSynthesis &&
  typeof window.speechSynthesis.addEventListener === 'function'
) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    const hasVoice = refreshSpeechVoices('voiceschanged');
    if (!hasVoice) {
      logSpeechError('speechSynthesis voiceschanged but no voices are available', {
        count: availableSpeechVoices.length,
      });
    }
  });
}

const init = async () => {
  setupSidebarMenus();
  syncChapterSelectorState();
  setupLearningStageObserver();

  try {
    const response = await fetch('data/chapters.json');
    if (!response.ok) {
      throw new Error('chapters.json の読み込みに失敗しました');
    }
    chapters = await response.json();
    const quizResponse = await fetch('data/quizzes.json');
    if (!quizResponse.ok) {
      throw new Error('quizzes.json の読み込みに失敗しました');
    }
    quizzes = await quizResponse.json();
    shuffledChoicesByQuestionId = new Map();
    selectedDomainName = chapters[0]?.domain ?? '';
    renderDomainList();
    renderChapterList(selectedDomainName);
    await selectChapterByIndex(0);
  } catch (error) {
    domainList.textContent = error.message;
    chapterList.textContent = error.message;
    selectedTitle.textContent = '読み込みエラー';
    renderChapterOverviewProgress();
  }
};

init();
