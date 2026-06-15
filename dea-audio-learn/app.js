const chapterList = document.querySelector('#chapter-list');
const selectedDomain = document.querySelector('#selected-domain');
const selectedTitle = document.querySelector('#selected-chapter-title');
const selectedChapterNo = document.querySelector('#selected-chapter-no');
const selectedMinutes = document.querySelector('#selected-minutes');
const selectedStatus = document.querySelector('#selected-status');
const selectedPosition = document.querySelector('#selected-position');
const previousChapterButton = document.querySelector('#previous-chapter');
const nextChapterButton = document.querySelector('#next-chapter');
const contentMarkdown = document.querySelector('#content-markdown');
const audioScriptMarkdown = document.querySelector('#audio-script-markdown');

let chapters = [];
let selectedChapterIndex = 0;

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
    button.classList.toggle('is-active', button.dataset.chapterId === chapterId);
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

  selectedChapterIndex = chapterIndex;
  updateActiveChapter(chapter.id);
  updateChapterNavigation();
  selectedDomain.textContent = chapter.domain;
  selectedTitle.textContent = chapter.title;
  selectedChapterNo.textContent = `Chapter ${chapter.chapterNo}`;
  selectedPosition.textContent = `Chapter ${chapterIndex + 1} / ${chapters.length}`;
  selectedMinutes.textContent = `${chapter.estimatedMinutes}分`;
  selectedStatus.textContent = chapter.status;
  contentMarkdown.textContent = '本文を読み込み中...';
  audioScriptMarkdown.textContent = '音声スクリプトを読み込み中...';

  try {
    const [content, audioScript] = await Promise.all([
      fetchText(chapter.contentPath),
      fetchText(chapter.audioScriptPath),
    ]);
    contentMarkdown.innerHTML = renderMarkdown(content);
    audioScriptMarkdown.innerHTML = renderMarkdown(audioScript);
  } catch (error) {
    contentMarkdown.textContent = error.message;
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

const init = async () => {
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
