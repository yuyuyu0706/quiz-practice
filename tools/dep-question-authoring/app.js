import {
  buildVariantComparison,
  buildVariantGroupIndex,
  searchVariantGroups,
} from './variant-authoring.js';
import { inspectVariantSelection } from './variant-inspector.js';
import {
  addQuestionToVariantGroup,
  cloneQuestions,
  createVariantGroup,
  removeQuestionFromVariantGroup,
  renameVariantGroup,
} from './variant-editing.js';
import { buildQuestionsExport, validateWorkingQuestions } from './variant-validation.js';

const state = {
  sourceQuestions: [],
  workingQuestions: [],
  selectedGroupId: null,
  query: '',
  dirty: false,
  inspector: { mode: 'normal', sections: [], progress: {} },
  validation: { valid: true, errors: [], raw: '' },
};
const groupsNode = document.querySelector('#groups');
const comparisonNode = document.querySelector('#comparison');
const inspectorNode = document.querySelector('#inspector');
const validationNode = document.querySelector('#validation');
const statusNode = document.querySelector('#status');
const dirtyNode = document.querySelector('#dirty');

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

function renderGroups() {
  const groups = searchVariantGroups(state.workingQuestions, state.query);
  groupsNode.innerHTML =
    groups
      .map(
        (group) =>
          `<button data-group="${escapeHtml(group.id)}" class="${group.id === state.selectedGroupId ? 'active' : ''}">${escapeHtml(group.id)} <span class="badge">${group.members.length}</span></button>`
      )
      .join('') || '<p class="meta">該当するグループはありません。</p>';
}

function renderCreateList() {
  document.querySelector('#create-list').innerHTML = state.workingQuestions
    .filter((question) => question.variantGroup == null)
    .map(
      (question) =>
        `<label><input type="checkbox" name="questionIds" value="${escapeHtml(question.id)}"> ${escapeHtml(question.id)} — ${escapeHtml(question.question)}</label>`
    )
    .join('');
}

function applyEdit(nextQuestions, selectedGroupId = state.selectedGroupId) {
  state.workingQuestions = nextQuestions;
  state.selectedGroupId = selectedGroupId;
  state.dirty = true;
  state.validation = validateWorkingQuestions(nextQuestions);
  render();
}

function showOperationError(message = '') {
  document.querySelector('#operation-error').textContent = message;
}

function renderSelected() {
  const members = state.workingQuestions.filter(
    (question) => question.variantGroup === state.selectedGroupId
  );
  comparisonNode.hidden = !members.length;
  if (!members.length) return;
  const comparison = buildVariantComparison(members);
  const ungrouped = state.workingQuestions.filter((question) => question.variantGroup == null);
  comparisonNode.innerHTML = `<p class="eyebrow">MEMBER COMPARISON</p><div class="title-row"><h2>${escapeHtml(state.selectedGroupId)} <span class="badge">${members.length} members</span></h2><span class="health ${state.validation.errors.some((error) => String(error).includes(state.selectedGroupId) || members.some((m) => String(error).includes(m.id))) ? 'fail' : 'pass'}">Group health</span></div>
    <form id="rename-form" class="inline-form"><label>New Group ID<input name="groupId" required></label><button type="submit">Rename group</button></form>
    <div class="cards">${comparison
      .map(
        (item) =>
          `<article class="card"><h3>${escapeHtml(item.id)}</h3><p class="meta">Section ${escapeHtml(item.section)} · ${escapeHtml(item.sectionTitle)} · ${escapeHtml(item.difficulty)}</p><p>${escapeHtml(item.question)}</p><p><strong>Answer:</strong> ${escapeHtml(item.answer)}</p><ol class="choices">${Object.entries(
            item.choices
          )
            .map(([label, text]) => `<li>${escapeHtml(label)}: ${escapeHtml(text)}</li>`)
            .join(
              ''
            )}</ol><p class="meta"><strong>Follow-up:</strong> ${escapeHtml(item.followUpTargetId ?? 'なし')}</p><button class="danger" data-remove="${escapeHtml(item.id)}">Remove member</button></article>`
      )
      .join('')}</div>
    <form id="add-form" class="inline-form"><label>Add ungrouped question<select name="questionId">${ungrouped.map((q) => `<option value="${escapeHtml(q.id)}">${escapeHtml(q.id)} — ${escapeHtml(q.question)}</option>`).join('')}</select></label><button type="submit" ${ungrouped.length ? '' : 'disabled'}>Add member</button></form>`;
  comparisonNode.querySelector('#rename-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const newId = new FormData(event.currentTarget).get('groupId');
      applyEdit(renameVariantGroup(state.workingQuestions, state.selectedGroupId, newId), newId);
    } catch (error) {
      showOperationError(error.message);
    }
  });
  comparisonNode.querySelector('#add-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const id = new FormData(event.currentTarget).get('questionId');
      applyEdit(addQuestionToVariantGroup(state.workingQuestions, id, state.selectedGroupId));
    } catch (error) {
      showOperationError(error.message);
    }
  });
  comparisonNode.querySelectorAll('[data-remove]').forEach((button) =>
    button.addEventListener('click', () => {
      try {
        applyEdit(removeQuestionFromVariantGroup(state.workingQuestions, button.dataset.remove));
      } catch (error) {
        showOperationError(error.message);
      }
    })
  );
  renderInspector(members);
}

function renderInspector(members) {
  const inspector = state.inspector;
  inspectorNode.hidden = false;
  inspectorNode.innerHTML = `<p class="eyebrow">SELECTION INSPECTOR · MEMORY ONLY</p><h2>代表選択を診断</h2><div class="controls"><label>Mode<select id="mode">${['normal', 'random', 'wrongOnly', 'bookmarks', 'notesOnly'].map((mode) => `<option ${mode === inspector.mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></label><label>Section<select id="section"><option value="all">すべて</option>${[...new Set(state.workingQuestions.map((q) => q.section))].map((section) => `<option ${inspector.sections.length === 1 && inspector.sections[0] === section ? 'selected' : ''}>${escapeHtml(section)}</option>`).join('')}</select></label></div><div id="result" class="result"></div>`;
  inspectorNode.querySelector('#mode').addEventListener('change', (event) => {
    inspector.mode = event.target.value;
    updateResult();
  });
  inspectorNode.querySelector('#section').addEventListener('change', (event) => {
    inspector.sections =
      event.target.value === 'all'
        ? [...new Set(state.workingQuestions.map((q) => q.section))]
        : [event.target.value];
    updateResult();
  });
  updateResult();
}

function updateResult() {
  const result = inspectVariantSelection({
    questions: state.workingQuestions,
    groupId: state.selectedGroupId,
    settings: { sections: state.inspector.sections },
    mode: state.inspector.mode,
    progress: state.inspector.progress,
  });
  document.querySelector('#result').innerHTML =
    `<strong>Winner: ${escapeHtml(result.winnerId ?? 'なし')}</strong><ul>${result.members.map((item) => `<li class="${item.selected ? 'selected' : item.eligible ? '' : 'excluded'}">${escapeHtml(item.id)} — ${escapeHtml(item.reason)}</li>`).join('')}</ul>`;
}

function renderValidation() {
  validationNode.innerHTML = `<div class="title-row"><h2>Validation</h2><strong class="${state.validation.valid ? 'pass' : 'fail'}">${state.validation.valid ? '✓ PASS' : '✕ FAIL'} · ${state.validation.errors.length} errors</strong></div>${state.validation.errors.length ? `<ul class="errors">${state.validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : '<p class="meta">Canonical DEP validator found no errors.</p>'}`;
  dirtyNode.hidden = !state.dirty;
  document.querySelector('#reset').disabled = !state.dirty;
  document.querySelector('#export').disabled = !state.validation.valid;
}

function render() {
  showOperationError();
  renderGroups();
  renderCreateList();
  renderSelected();
  renderValidation();
}

groupsNode.addEventListener('click', (event) => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  state.selectedGroupId = button.dataset.group;
  render();
});
document.querySelector('#search').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderGroups();
});
document.querySelector('#create-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const data = new FormData(event.currentTarget);
    const groupId = data.get('groupId');
    const ids = data.getAll('questionIds');
    applyEdit(createVariantGroup(state.workingQuestions, ids, groupId), groupId);
    event.currentTarget.reset();
  } catch (error) {
    showOperationError(error.message);
  }
});
document.querySelector('#reset').addEventListener('click', () => {
  if (!state.dirty || !confirm('Discard all variantGroup edits?')) return;
  state.workingQuestions = cloneQuestions(state.sourceQuestions);
  state.dirty = false;
  state.validation = validateWorkingQuestions(state.workingQuestions);
  const groups = buildVariantGroupIndex(state.workingQuestions);
  if (!groups.some((group) => group.id === state.selectedGroupId)) {
    state.selectedGroupId = groups[0]?.id ?? null;
  }
  render();
});
document.querySelector('#export').addEventListener('click', () => {
  const result = buildQuestionsExport(state.workingQuestions);
  state.validation = validateWorkingQuestions(state.workingQuestions);
  renderValidation();
  if (!result.ok) return;
  const url = URL.createObjectURL(new Blob([result.content], { type: result.mimeType }));
  const link = Object.assign(document.createElement('a'), { href: url, download: result.filename });
  link.click();
  URL.revokeObjectURL(url);
});
window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

try {
  const response = await fetch('/dep-quiz-app/questions.json');
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  state.sourceQuestions = cloneQuestions(await response.json());
  state.workingQuestions = cloneQuestions(state.sourceQuestions);
  state.inspector.sections = [...new Set(state.workingQuestions.map((q) => q.section))];
  state.selectedGroupId = buildVariantGroupIndex(state.workingQuestions)[0]?.id ?? null;
  state.validation = validateWorkingQuestions(state.workingQuestions);
  statusNode.remove();
  render();
} catch (error) {
  statusNode.textContent = `読み込みに失敗しました: ${error.message}`;
}
