export function buildSectionCheckboxes(container, questions) {
  const sectionMap = new Map();
  questions.forEach((question) => {
    if (!sectionMap.has(question.section)) {
      sectionMap.set(question.section, question.sectionTitle ?? '');
    }
  });

  const sections = Array.from(sectionMap.entries()).sort(
    ([sectionA], [sectionB]) => Number(sectionA) - Number(sectionB)
  );

  container.replaceChildren(
    ...sections.map(([section, sectionTitle]) => createSectionCheckbox(section, sectionTitle))
  );
}

export function hydrateSettingsUI(elements, settings) {
  const { form, questionCount, sectionCheckboxes } = elements;
  questionCount.value = settings.count;

  const sections = new Set(settings.sections);
  sectionCheckboxes.querySelectorAll('input[name="sections"]').forEach((input) => {
    input.checked = sections.has(input.value);
  });

  const modeInput = form.querySelector(`input[name="mode"][value="${settings.mode}"]`);
  if (modeInput) modeInput.checked = true;
}

export function readSettingsFromUI(elements) {
  const { form, questionCount, sectionCheckboxes } = elements;
  const sections = Array.from(sectionCheckboxes.querySelectorAll('input:checked')).map(
    (input) => input.value
  );

  if (!sections.length) {
    return {
      ok: false,
      message: '最低1つのセクションを選択してください。',
      settings: null,
    };
  }

  return {
    ok: true,
    message: '',
    settings: {
      sections,
      mode: form.querySelector('input[name="mode"]:checked').value,
      count: questionCount.value,
    },
  };
}

function createSectionCheckbox(section, sectionTitle) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'sections';
  input.value = section;
  input.checked = true;

  const labelText = document.createElement('span');
  labelText.className = 'section-label';

  const sectionNumber = document.createElement('span');
  sectionNumber.className = 'section-number';
  sectionNumber.textContent = `Section ${section}`;

  const title = document.createElement('span');
  title.className = 'section-title';
  title.textContent = sectionTitle;

  labelText.append(sectionNumber, title);
  label.append(input, labelText);

  return label;
}
