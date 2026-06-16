const chapterList = document.querySelector('#chapter-list');
const chapterSelector = document.querySelector('#chapter-selector');
const selectedDomain = document.querySelector('#selected-domain');
const selectedTitle = document.querySelector('#selected-chapter-title');
const selectedMinutes = document.querySelector('#selected-minutes');
const selectedStatus = document.querySelector('#selected-status');
const previousChapterButton = document.querySelector('#previous-chapter');
const nextChapterButton = document.querySelector('#next-chapter');
const audioScriptMarkdown = document.querySelector('#audio-script-markdown');
const speechToggleButton = document.querySelector('#speech-toggle');
const speechRateSelect = document.querySelector('#speech-rate');
const speechStatus = document.querySelector('#speech-status');
const speechMessage = document.querySelector('#speech-message');

let chapters = [];
let selectedChapterIndex = 0;
let currentAudioScriptText = '';
let speechState = 'idle';
let activeUtterance = null;
let speechRunId = 0;
let lastSpeechResetReason = 'initial';
let availableSpeechVoices = [];
let selectedSpeechVoice = null;

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
  speaking: '読み上げ中',
  paused: '一時停止中',
  ended: '読み上げ完了',
  error: '読み上げエラー',
  noVoices: '利用不可',
  unsupported: '利用不可',
};

const speechButtonLabels = {
  idle: '再生',
  speaking: '一時停止',
  paused: '再開',
  ended: '最初から再生',
  error: '再生',
  noVoices: '利用不可',
  unsupported: '利用不可',
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

const removeAudioScriptTitle = (markdown) =>
  markdown.replace(/^#\s*音声スクリプト:[^\n]*(?:\r?\n)+/u, '').trimStart();

const stripMarkdownForSpeech = (markdown) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const updateSpeechUI = () => {
  const unavailable = speechState === 'unsupported' || speechState === 'noVoices';
  speechToggleButton.textContent = speechButtonLabels[speechState];
  speechToggleButton.disabled = unavailable || !currentAudioScriptText;
  speechRateSelect.disabled = unavailable;
  speechStatus.textContent = speechStatusLabels[speechState];
  if (speechState === 'unsupported') {
    speechMessage.hidden = false;
    speechMessage.textContent =
      'このブラウザでは読み上げ機能に対応していません。対応ブラウザでお試しください。';
  } else if (speechState === 'noVoices') {
    speechMessage.hidden = false;
    speechMessage.textContent = noVoicesMessage;
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
  const canUseSpeechApi = isSpeechSupported();
  const hasVoices = refreshSpeechVoices('chapter-change');

  speechRunId += 1;
  lastSpeechResetReason = 'chapter-change';
  if (canUseSpeechApi) {
    logSpeech('resetSpeechForChapterChange: calling speechSynthesis.cancel()', { speechRunId });
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (hasVoices) setSpeechState('idle');
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
  const utterance = new SpeechSynthesisUtterance(currentAudioScriptText);
  utterance.lang = selectedSpeechVoice?.lang ?? 'ja-JP';
  utterance.voice = selectedSpeechVoice;
  utterance.rate = Number(speechRateSelect.value);
  utterance.onstart = (event) => {
    logSpeech('SpeechSynthesisUtterance onstart', { runId, event });
  };
  utterance.onpause = (event) => {
    logSpeech('SpeechSynthesisUtterance onpause', { runId, event });
  };
  utterance.onresume = (event) => {
    logSpeech('SpeechSynthesisUtterance onresume', { runId, event });
  };
  utterance.onend = (event) => {
    logSpeech('SpeechSynthesisUtterance onend', {
      runId,
      currentSpeechRunId: speechRunId,
      lastSpeechResetReason,
      event,
    });
    if (runId !== speechRunId) return;
    activeUtterance = null;
    setSpeechState('ended');
  };
  utterance.onerror = (event) => {
    const voices = getAvailableSpeechVoices();
    logSpeechError('SpeechSynthesisUtterance onerror', {
      runId,
      currentSpeechRunId: speechRunId,
      lastSpeechResetReason,
      error: event.error,
      voicesCount: voices.length,
      selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
      utteranceLang: utterance.lang,
      utteranceRate: utterance.rate,
      textLength: utterance.text.length,
      event,
    });
    if (runId !== speechRunId) return;
    activeUtterance = null;
    showSpeechError(`読み上げに失敗しました（${event.error}）。${speechUnavailableMessage}`);
  };
  activeUtterance = utterance;
  setSpeechState('speaking');
  lastSpeechResetReason = 'play-request';
  logSpeech('calling speechSynthesis.speak()', {
    runId,
    rate: utterance.rate,
    lang: utterance.lang,
    textLength: utterance.text.length,
    voicesCount: availableSpeechVoices.length,
    selectedVoice: selectedSpeechVoice ? describeVoice(selectedSpeechVoice) : null,
    pending: window.speechSynthesis.pending,
    speaking: window.speechSynthesis.speaking,
    paused: window.speechSynthesis.paused,
  });
  window.speechSynthesis.speak(utterance);
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

  if (speechState === 'idle' || speechState === 'ended' || speechState === 'error') {
    speakFromStart();
  }
};

const mobileChapterSelectorQuery = window.matchMedia('(max-width: 780px)');

const syncChapterSelectorState = () => {
  chapterSelector.open = !mobileChapterSelectorQuery.matches;
};

const renderMarkdown = (markdown) => {
  if (window.marked) {
    return window.marked.parse(markdown);
  }

  const escaped = markdown.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<pre>${escaped}</pre>`;
};

const fetchText = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} の読み込みに失敗しました`);
  }
  return response.text();
};

const renderChapterList = () => {
  chapterList.innerHTML = '';

  chapters.forEach((chapter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.dataset.chapterId = chapter.id;
    button.innerHTML = `
      <span>Chapter ${chapter.chapterNo}</span>
      <strong>${chapter.title}</strong>
      <small>${chapter.domain}</small>
    `;
    button.addEventListener('click', () => selectChapterById(chapter.id));
    chapterList.append(button);
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
  selectedChapterIndex = chapterIndex;
  updateActiveChapter(chapter.id);
  updateChapterNavigation();
  selectedDomain.textContent = chapter.domain;
  selectedTitle.textContent = chapter.title;
  selectedMinutes.textContent = `音声目安：約${chapter.estimatedMinutes}分`;
  selectedStatus.textContent = chapter.status;
  audioScriptMarkdown.textContent = '音声スクリプトを読み込み中...';

  try {
    const audioScript = removeAudioScriptTitle(await fetchText(chapter.audioScriptPath));
    audioScriptMarkdown.innerHTML = renderMarkdown(audioScript);
    currentAudioScriptText = stripMarkdownForSpeech(audioScript);
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

speechToggleButton.addEventListener('click', handleSpeechToggle);
speechRateSelect.addEventListener('change', () => {
  logSpeech('speech rate changed', {
    rate: Number(speechRateSelect.value),
    speechState,
    appliesTo:
      speechState === 'speaking' || speechState === 'paused' ? 'next playback' : 'next utterance',
  });
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
  syncChapterSelectorState();
  mobileChapterSelectorQuery.addEventListener('change', syncChapterSelectorState);

  try {
    const response = await fetch('data/chapters.json');
    if (!response.ok) {
      throw new Error('chapters.json の読み込みに失敗しました');
    }
    chapters = await response.json();
    renderChapterList();
    await selectChapterByIndex(0);
  } catch (error) {
    chapterList.textContent = error.message;
    selectedTitle.textContent = '読み込みエラー';
  }
};

init();
