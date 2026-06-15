const chapterList = document.querySelector('#chapter-list');
const selectedDomain = document.querySelector('#selected-domain');
const selectedTitle = document.querySelector('#selected-chapter-title');
const selectedChapterNo = document.querySelector('#selected-chapter-no');
const selectedMinutes = document.querySelector('#selected-minutes');
const selectedStatus = document.querySelector('#selected-status');
const contentMarkdown = document.querySelector('#content-markdown');
const audioScriptMarkdown = document.querySelector('#audio-script-markdown');

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

const renderChapterList = (chapters) => {
  chapterList.innerHTML = '';

  chapters.forEach((chapter, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.dataset.chapterId = chapter.id;
    button.innerHTML = `
      <span>Chapter ${chapter.chapterNo}</span>
      <strong>${chapter.title}</strong>
      <small>${chapter.domain}</small>
    `;
    button.addEventListener('click', () => selectChapter(chapter));
    chapterList.append(button);

    if (index === 0) {
      button.classList.add('is-active');
    }
  });
};

const updateActiveChapter = (chapterId) => {
  document.querySelectorAll('.chapter-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.chapterId === chapterId);
  });
};

const selectChapter = async (chapter) => {
  updateActiveChapter(chapter.id);
  selectedDomain.textContent = chapter.domain;
  selectedTitle.textContent = chapter.title;
  selectedChapterNo.textContent = `Chapter ${chapter.chapterNo}`;
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

const init = async () => {
  try {
    const response = await fetch('data/chapters.json');
    if (!response.ok) {
      throw new Error('chapters.json の読み込みに失敗しました');
    }
    const chapters = await response.json();
    renderChapterList(chapters);
    await selectChapter(chapters[0]);
  } catch (error) {
    chapterList.textContent = error.message;
    selectedTitle.textContent = '読み込みエラー';
  }
};

init();
