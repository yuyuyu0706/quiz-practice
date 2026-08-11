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
  reconcileSelectedGroupId,
  renameVariantGroup,
  searchUngroupedQuestions,
} from './variant-editing.js';
import { buildQuestionsExport, validateWorkingQuestions } from './variant-validation.js';

const state = {
  sourceQuestions: [],
  workingQuestions: [],
  selectedGroupId: null,
  query: '',
  createQuery: '',
  dirty: false,
  inspector: { mode: 'normal', sections: [], progress: {} },
  validation: { valid: true, errors: [], raw: '' },
  loadState: 'loading',
};
const groupsNode = document.querySelector('#groups');
const comparisonNode = document.querySelector('#comparison');
const inspectorNode = document.querySelector('#inspector');
const validationNode = document.querySelector('#validation-content');
const validationStatusNode = document.querySelector('#validation-status');
const validationResultNode = document.querySelector('#validation-result');
const validationDetailsNode = document.querySelector('#validation');
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
      .join('') ||
    '<p class="empty-state">該当するグループはありません。検索語を短くするか、空欄にして全 group を表示してください。</p>';
}

function renderCreateList() {
  document.querySelector('#create-list').innerHTML = searchUngroupedQuestions(
    state.workingQuestions,
    state.createQuery
  )
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

function showCreateOperationError(message = '') {
  document.querySelector('#operation-error').textContent = message;
}

function showComparisonOperationError(message = '') {
  const errorNode = document.querySelector('#comparison-operation-error');
  if (errorNode) errorNode.textContent = message;
}

function renderSelected() {
  const selectedGroupId = reconcileSelectedGroupId(state.workingQuestions, state.selectedGroupId);
  if (selectedGroupId !== state.selectedGroupId) {
    state.selectedGroupId = selectedGroupId;
    renderGroups();
  }
  const members = state.workingQuestions.filter(
    (question) => question.variantGroup === state.selectedGroupId
  );
  const comparisonPanel = document.querySelector('#comparison-panel');
  const inspectorPanel = document.querySelector('#inspector-panel');
  comparisonNode.hidden = !members.length;
  if (!members.length) {
    comparisonNode.innerHTML = '';
    inspectorNode.hidden = true;
    comparisonPanel.open = false;
    inspectorPanel.open = false;
    inspectorNode.innerHTML = '';
    return;
  }
  const comparison = buildVariantComparison(members);
  const ungrouped = state.workingQuestions.filter((question) => question.variantGroup == null);
  const followUps = members.filter((member) => member.followUp?.questionId);
  comparisonNode.innerHTML = `<div class="title-row"><h2>${escapeHtml(state.selectedGroupId)} <span class="badge">${members.length} members</span></h2><span class="health ${state.validation.errors.some((error) => String(error).includes(state.selectedGroupId) || members.some((m) => String(error).includes(m.id))) ? 'fail' : 'pass'}">Group health</span></div><div class="comparison-guide"><p>このメニューでは、選択中のVariant Groupを確認・編集できます。</p><ul><li>問題本文・選択肢・正解・followUpを比較する</li><li>Variant Groupのメンバーを追加・削除する</li><li>Group Nameを変更する</li></ul><p>同じ論点の「出題バリエーション」として扱える問題だけを同じVariant Groupへ所属させてください。</p></div>
    <form id="rename-form" class="inline-form"><label>Group Name<input name="groupId" required></label><button type="submit">Rename group</button></form>
    <p id="comparison-operation-error" class="fail operation-error" role="alert"></p>
    <p class="help">questions.jsonでは<code>variantGroup</code>として保存されます。英小文字・数字・ハイフンによる安定した名前を推奨します。</p>
    <section class="relationship-map" aria-labelledby="relationship-title"><h3 id="relationship-title">Relationship Map</h3><p class="meta">Variant Group: ${escapeHtml(state.selectedGroupId)}</p><div class="relation-graph"><div class="variant-relation" aria-label="Variant Group members: ${members.map((member) => escapeHtml(member.id)).join(', ')}">${members.map((member, index) => `${index ? '<span class="variant-edge" aria-hidden="true"></span>' : ''}<strong class="relation-node">${escapeHtml(member.id)}</strong>`).join('')}</div>${followUps.map((member) => `<div class="follow-up-relation" aria-label="${escapeHtml(member.id)} followUp to ${escapeHtml(member.followUp.questionId)}"><span class="relation-branch" aria-hidden="true">└─</span><span class="edge-label">followUp</span><span class="relation-arrow" aria-hidden="true">──→</span><strong class="relation-node">${escapeHtml(member.followUp.questionId)}</strong></div>`).join('')}</div></section>
    <div class="cards">${comparison
      .map(
        (item) =>
          `<article class="card"><h3>${escapeHtml(item.id)}</h3><p class="meta">Section ${escapeHtml(item.section)} · ${escapeHtml(item.sectionTitle)} · ${escapeHtml(item.difficulty)}</p><p>${escapeHtml(item.question)}</p><p><strong>Answer:</strong> ${escapeHtml(item.answer)}</p><ol class="choices">${Object.entries(
            item.choices
          )
            .map(([label, text]) => `<li>${escapeHtml(label)}: ${escapeHtml(text)}</li>`)
            .join(
              ''
            )}</ol><p class="meta"><strong>Choice text multiset</strong><br>${item.choiceTextMultiset.map(escapeHtml).join(' · ')}</p><p class="meta"><strong>Follow-up:</strong> ${escapeHtml(item.followUpTargetId ?? 'なし')}</p><button class="danger" data-remove="${escapeHtml(item.id)}">Remove member</button></article>`
      )
      .join('')}</div>
    <form id="add-form" class="inline-form"><label>Add ungrouped question<select name="questionId">${ungrouped.map((q) => `<option value="${escapeHtml(q.id)}">${escapeHtml(q.id)} — ${escapeHtml(q.question)}</option>`).join('')}</select></label><button type="submit" ${ungrouped.length ? '' : 'disabled'}>Add member</button></form>`;
  comparisonNode.querySelector('#rename-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const newId = new FormData(event.currentTarget).get('groupId');
      applyEdit(renameVariantGroup(state.workingQuestions, state.selectedGroupId, newId), newId);
    } catch (error) {
      showComparisonOperationError(error.message);
    }
  });
  comparisonNode.querySelector('#add-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const id = new FormData(event.currentTarget).get('questionId');
      applyEdit(addQuestionToVariantGroup(state.workingQuestions, id, state.selectedGroupId));
    } catch (error) {
      showComparisonOperationError(error.message);
    }
  });
  comparisonNode.querySelectorAll('[data-remove]').forEach((button) =>
    button.addEventListener('click', () => {
      try {
        applyEdit(removeQuestionFromVariantGroup(state.workingQuestions, button.dataset.remove));
      } catch (error) {
        showComparisonOperationError(error.message);
      }
    })
  );
  renderInspector(members);
}

function renderInspector(members) {
  const inspector = state.inspector;
  inspectorNode.hidden = false;
  const modeLabels = {
    normal: '通常出題',
    random: 'ランダム出題',
    wrongOnly: '誤答した問題のみ',
    bookmarks: 'ブックマークのみ',
    notesOnly: 'メモあり問題のみ',
  };
  inspectorNode.innerHTML = `<h2>代表選択を診断</h2><p class="help">Variant Groupから1sessionに採用される問題は最大1問です。<br>どの問題が代表として選ばれるかを、本機能でシミュレーションできます。</p><div class="controls"><label>Session Mode（出題モード）<select id="mode">${Object.entries(
    modeLabels
  )
    .map(
      ([mode, label]) =>
        `<option value="${mode}" ${mode === inspector.mode ? 'selected' : ''}>${mode} — ${label}</option>`
    )
    .join(
      ''
    )}</select></label><label>Target Section（出題対象Section）<select id="section"><option value="all">すべて</option>${[...new Set(state.workingQuestions.map((q) => q.section))].map((section) => `<option ${inspector.sections.length === 1 && inspector.sections[0] === section ? 'selected' : ''}>${escapeHtml(section)}</option>`).join('')}</select></label></div><div class="progress-grid"><strong>Member</strong><span>seen</span><span>wrong</span><span>bookmark</span><span>note</span>${members
    .map((member) => {
      const progress = inspector.progress[member.id] ?? {};
      return `<strong>${escapeHtml(member.id)}</strong><input data-id="${escapeHtml(member.id)}" data-field="seenCount" type="number" min="0" value="${progress.seenCount ?? 0}"><input data-id="${escapeHtml(member.id)}" data-field="wrongCount" type="number" min="0" value="${progress.wrongCount ?? 0}"><input data-id="${escapeHtml(member.id)}" data-field="bookmark" type="checkbox" ${progress.bookmark ? 'checked' : ''}><input data-id="${escapeHtml(member.id)}" data-field="noteText" value="${escapeHtml(progress.noteText ?? '')}" aria-label="${escapeHtml(member.id)} note">`;
    })
    .join('')}</div><div id="result" class="result"></div>`;
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
  inspectorNode.querySelectorAll('[data-field]').forEach((input) =>
    input.addEventListener('input', () => {
      const progress = (inspector.progress[input.dataset.id] ??= {});
      progress[input.dataset.field] =
        input.type === 'checkbox'
          ? input.checked
          : input.type === 'number'
            ? Number(input.value)
            : input.value;
      updateResult();
    })
  );
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
    `<strong>Winner: ${escapeHtml(result.winnerId ?? 'なし')}</strong>${result.randomBoundary ? `<p>${escapeHtml(result.randomBoundary)}</p>` : ''}<ul>${result.members.map((item) => `<li class="${item.selected ? 'selected' : item.eligible ? '' : 'excluded'}">${escapeHtml(item.id)} — ${escapeHtml(item.reason)}</li>`).join('')}</ul>`;
}

function renderValidation() {
  validationStatusNode.className = `validation-status ${state.validation.valid ? 'pass' : 'fail'}`;
  validationStatusNode.textContent = `Validation ${state.validation.valid ? '✓ PASS' : '✕ FAIL'} · ${state.validation.errors.length} errors`;
  validationResultNode.className = `validation-result ${state.validation.valid ? 'pass' : 'fail'}`;
  validationResultNode.innerHTML = state.validation.valid
    ? '<strong>Result : OK</strong> — Canonical DEP validator found no errors.'
    : `<strong>Result : NG</strong> — ${state.validation.errors.length} validation errors found.`;
  validationDetailsNode.hidden = state.validation.errors.length === 0;
  if (!state.validation.errors.length) validationDetailsNode.open = false;
  validationNode.innerHTML = state.validation.errors.length
    ? `<ul class="errors">${state.validation.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>${state.validation.errors.some((error) => String(error).includes('must use the same choice text multiset')) ? '<p class="validation-guidance"><a href="#choice-multiset-help" id="choice-multiset-help-link">エラー対策 &gt; 同じchoice text multisetではない</a>を確認してください。</p>' : ''}`
    : '';
  document.querySelector('#choice-multiset-help-link')?.addEventListener('click', () => {
    document.querySelector('#error-help').open = true;
  });
  dirtyNode.hidden = !state.dirty;
  document.querySelector('#reset').disabled = !state.dirty;
  document.querySelector('#export').disabled =
    state.loadState !== 'loaded' || !state.validation.valid;
}

function render() {
  showCreateOperationError();
  renderGroups();
  renderCreateList();
  renderSelected();
  renderValidation();
}

groupsNode.addEventListener('click', (event) => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  state.selectedGroupId = button.dataset.group;
  document.querySelector('#comparison-panel').open = true;
  document.querySelector('#create-panel').open = false;
  document.querySelector('#inspector-panel').open = false;
  render();
});

document.querySelectorAll('.accordion').forEach((panel) => {
  panel.addEventListener('toggle', () => {
    if (!panel.open) return;
    document.querySelectorAll('.accordion').forEach((other) => {
      if (other !== panel) other.open = false;
    });
  });
});
document.querySelector('#search').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderGroups();
});
document.querySelector('#create-search').addEventListener('input', (event) => {
  state.createQuery = event.target.value;
  renderCreateList();
});
document.querySelector('#create-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const data = new FormData(event.currentTarget);
    const groupId = data.get('groupId');
    const ids = data.getAll('questionIds');
    state.createQuery = '';
    applyEdit(createVariantGroup(state.workingQuestions, ids, groupId), groupId);
    document.querySelector('#comparison-panel').open = true;
    event.currentTarget.reset();
  } catch (error) {
    showCreateOperationError(error.message);
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
  const loadedQuestions = await response.json();
  if (!Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
    throw new Error('questions.json に利用可能な問題がありません。');
  }
  state.sourceQuestions = cloneQuestions(loadedQuestions);
  state.loadState = 'loaded';
  state.workingQuestions = cloneQuestions(state.sourceQuestions);
  state.inspector.sections = [...new Set(state.workingQuestions.map((q) => q.section))];
  state.selectedGroupId = buildVariantGroupIndex(state.workingQuestions)[0]?.id ?? null;
  state.validation = validateWorkingQuestions(state.workingQuestions);
  render();
  const groupCount = buildVariantGroupIndex(state.workingQuestions).length;
  statusNode.classList.add('status-success');
  statusNode.textContent = `読み込み完了: ${state.workingQuestions.length} questions / ${groupCount} variant groups`;
  document.querySelector('#create-form button[type="submit"]').disabled = false;
} catch (error) {
  state.loadState = 'error';
  statusNode.classList.add('status-error');
  const isNotFound = String(error.message).startsWith('404 ');
  statusNode.innerHTML = isNotFound
    ? `<strong>questions.json が見つかりません (404)</strong><p>repository root を server root として、次の command で起動してください。</p><code>npm run serve:dep-question-authoring</code><p>Tool: <code>http://127.0.0.1:4173/tools/dep-question-authoring/</code><br>Data check: <code>http://127.0.0.1:4173/dep-quiz-app/questions.json</code></p><p>起動後にこのページを再読み込みしてください。</p>`
    : `<strong>questions.json の読み込みに失敗しました</strong><p>${escapeHtml(error.message)}</p><p>ネットワークまたは server の状態を確認し、ページを再読み込みしてください。</p>`;
  document.querySelectorAll('#create-form input, #create-form button').forEach((control) => {
    control.disabled = true;
  });
  document.querySelector('#reset').disabled = true;
  document.querySelector('#export').disabled = true;
}
