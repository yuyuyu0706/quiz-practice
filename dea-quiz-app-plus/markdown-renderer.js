function createCodeBlock(language, codeText) {
  const normalizedLanguage = String(language ?? '').toLowerCase();
  const pre = document.createElement('pre');
  pre.className = `code-block${normalizedLanguage ? ` lang-${normalizedLanguage}` : ''}`;

  const code = document.createElement('code');
  if (normalizedLanguage) code.className = `language-${normalizedLanguage}`;
  code.textContent = String(codeText ?? '');

  pre.appendChild(code);
  return pre;
}

export function appendInlineFormattedText(element, text) {
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

export function appendInlineFormattedTextWithLineBreaks(element, text) {
  String(text ?? '')
    .split('\n')
    .forEach((line, index, arr) => {
      appendInlineFormattedText(element, line);
      if (index < arr.length - 1) {
        element.appendChild(document.createElement('br'));
      }
    });
}

export function appendFormattedTextWithCodeBlocks(element, text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n');
  const segments = normalized.split(/(```[\s\S]*?```)/g).filter(Boolean);

  segments.forEach((segment) => {
    const codeMatch = segment.match(/^```\s*([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n?```$/);
    if (codeMatch) {
      element.appendChild(createCodeBlock(codeMatch[1] ?? '', codeMatch[2]));
      return;
    }

    appendInlineFormattedTextWithLineBreaks(element, segment);
  });
}

export function renderMarkdownToFragment(markdownText) {
  const source = String(markdownText ?? '');
  const fragment = document.createDocumentFragment();
  if (!source.trim()) {
    const empty = document.createElement('p');
    empty.textContent = '解説はまだ登録されていません。';
    fragment.appendChild(empty);
    return fragment;
  }

  const lines = source.replace(/\r\n/g, '\n').split('\n');
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
    ul.className = 'explanation-list';
    listBuffer.forEach((text) => {
      const li = document.createElement('li');
      appendInlineFormattedText(li, text);
      ul.appendChild(li);
    });
    fragment.appendChild(ul);
    listBuffer.length = 0;
  };

  const flushCode = () => {
    fragment.appendChild(createCodeBlock(codeLanguage, codeBuffer.join('\n')));
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
