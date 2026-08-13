import {
  buildVariantComparison,
  buildVariantGroupIndex,
  findUngroupedVariantCandidates,
  searchVariantGroups,
} from './variant-authoring.js';
import { inspectVariantSelection } from './variant-inspector.js';
import {
  buildCatalogFilterOptions,
  filterQuestionCatalog,
  reconcileSelectedQuestionId,
} from './question-catalog.js';
import {
  addQuestionToVariantGroup,
  cloneQuestions,
  createVariantGroup,
  deleteVariantGroup,
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
  candidateSeedQuestionId: '',
  dirty: false,
  inspector: { mode: 'normal', sections: [], progress: {} },
  validation: { valid: true, errors: [], raw: '' },
  loadState: 'loading',
  activeWorkspace: 'catalog',
  selectedQuestionId: null,
  catalogFilters: { keyword: '', section: '', domain: '', difficulty: '', sourceType: '' },
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
const catalogListNode = document.querySelector('#catalog-list');
const questionDetailNode = document.querySelector('#question-detail');

function setWorkspace(workspace) {
  state.activeWorkspace = workspace;
  document.querySelector('#catalog-workspace').hidden = workspace !== 'catalog';
  document.querySelector('#variant-workspace').hidden = workspace !== 'variant';
  document.querySelector('#catalog-tab').setAttribute('aria-selected', workspace === 'catalog');
  document.querySelector('#variant-tab').setAttribute('aria-selected', workspace === 'variant');
}

function renderCatalogFilters() {
  const options = buildCatalogFilterOptions(state.workingQuestions);
  document.querySelector('#catalog-filters').innerHTML = [
    ['section', 'Section'],
    ['domain', 'Domain'],
    ['difficulty', 'Difficulty'],
    ['sourceType', 'Source Type'],
  ]
    .map(
      ([field, label]) =>
        `<label>${label}<select data-catalog-filter="${field}"><option value="">All</option>${options[
          field
        ]
          .map(
            (value) =>
              `<option value="${escapeHtml(value)}" ${state.catalogFilters[field] === value ? 'selected' : ''}>${escapeHtml(value)}</option>`
          )
          .join('')}</select></label>`
    )
    .join('');
}

function renderQuestionDetail(question) {
  if (!question) {
    questionDetailNode.innerHTML = '<p class="empty-state">Questionを選択してください。</p>';
    return;
  }
  questionDetailNode.innerHTML = `<p class="eyebrow">QUESTION DETAIL</p>
    <div class="title-row"><h2>${escapeHtml(question.id)}</h2><span class="badge">${question.grouped ? 'Grouped' : 'Ungrouped'}</span></div>
    <p class="meta">Section ${escapeHtml(question.section || 'なし')} · ${escapeHtml(question.sectionTitle || 'なし')} · ${escapeHtml(question.domain || 'なし')}</p>
    <p class="meta">tags: ${escapeHtml(question.tags.join(', ') || 'なし')} · difficulty: ${escapeHtml(question.difficulty || 'なし')} · sourceType: ${escapeHtml(question.sourceType || 'なし')}</p>
    <p class="question-copy">${escapeHtml(question.question || '問題文なし')}</p>
    <ol class="choices">${Object.entries(question.choices)
      .map(
        ([label, choice]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(choice)}</li>`
      )
      .join('')}</ol>
    <p><strong>Answer:</strong> ${escapeHtml(question.answer || 'なし')}</p>
    <dl class="relation-detail"><dt>variantGroup</dt><dd>${escapeHtml(question.variantGroup || 'Ungrouped')}</dd><dt>followUp target</dt><dd>${escapeHtml(question.followUpTargetId || 'なし')}</dd></dl>
    <div class="future-actions" aria-label="Future authoring actions"><button type="button" disabled title="F2.6-2で有効化予定">Edit Question</button><button type="button" disabled title="F2.6-3で有効化予定">Clone Question</button><button type="button" disabled title="F2.6-3で有効化予定">Create Variant</button></div>
    <button id="open-variant-context" type="button" class="primary">${question.grouped ? 'Open group in Variant Management' : 'Find in Create Variant Group'}</button>`;
  document.querySelector('#open-variant-context').addEventListener('click', () => {
    setWorkspace('variant');
    if (question.grouped) {
      state.selectedGroupId = question.variantGroup;
      document.querySelector('#comparison-panel').open = true;
      document.querySelector('#create-panel').open = false;
      render();
    } else {
      state.createQuery = question.id;
      document.querySelector('#create-search').value = question.id;
      document.querySelector('#create-panel').open = true;
      document.querySelector('#comparison-panel').open = false;
      document.querySelector('#inspector-panel').open = false;
      renderCreateList();
    }
  });
}

function renderCatalog() {
  const entries = filterQuestionCatalog(state.workingQuestions, state.catalogFilters);
  state.selectedQuestionId = reconcileSelectedQuestionId(
    state.workingQuestions,
    state.selectedQuestionId
  );
  document.querySelector('#catalog-count').textContent =
    `${entries.length} / ${state.workingQuestions.length} questions`;
  catalogListNode.innerHTML = entries.length
    ? entries
        .map(
          (question) =>
            `<button type="button" data-question-id="${escapeHtml(question.id)}" class="${question.id === state.selectedQuestionId ? 'active' : ''}"><strong>${escapeHtml(question.id)}</strong><span>${escapeHtml(question.question || '問題文なし')}</span><small>Section ${escapeHtml(question.section || 'なし')} · ${escapeHtml(question.domain || 'なし')} · ${escapeHtml(question.difficulty || 'なし')} · ${escapeHtml(question.sourceType || 'なし')}<br>tags: ${escapeHtml(question.tags.join(', ') || 'なし')} · ${question.grouped ? `variantGroup: ${escapeHtml(question.variantGroup)}` : 'Ungrouped'} · followUp: ${escapeHtml(question.followUpTargetId || 'なし')}</small></button>`
        )
        .join('')
    : '<p class="empty-state">該当するQuestionはありません。検索条件を変更してください。</p>';
  const selected = filterQuestionCatalog(state.workingQuestions).find(
    (question) => question.id === state.selectedQuestionId
  );
  renderQuestionDetail(selected);
}

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

function renderCandidateAssist() {
  const ungrouped = state.workingQuestions.filter((question) => question.variantGroup == null);
  if (!ungrouped.some((question) => question.id === state.candidateSeedQuestionId)) {
    state.candidateSeedQuestionId = '';
  }
  const select = document.querySelector('#candidate-seed');
  select.innerHTML = `<option value="">Seed Questionを選択</option>${ungrouped
    .map(
      (question) =>
        `<option value="${escapeHtml(question.id)}" ${question.id === state.candidateSeedQuestionId ? 'selected' : ''}>${escapeHtml(question.id)} — ${escapeHtml(question.question)}</option>`
    )
    .join('')}`;
  const result = document.querySelector('#candidate-results');
  if (!state.candidateSeedQuestionId) {
    result.innerHTML = '<p class="empty-state">Seed Questionを選ぶと候補を表示します。</p>';
    return;
  }
  const candidates = findUngroupedVariantCandidates(
    state.workingQuestions,
    state.candidateSeedQuestionId
  );
  result.innerHTML = candidates.length
    ? `<p><strong>候補 ${candidates.length}件</strong> · 条件: Same choice set</p><ul class="candidate-list">${candidates
        .map(
          (question) =>
            `<li><strong>${escapeHtml(question.id)}</strong> — ${escapeHtml(question.question)}<p class="meta">Section ${escapeHtml(question.section ?? 'なし')}${question.tags?.length ? ` · tags: ${question.tags.map(escapeHtml).join(', ')}` : ''} · Same choice set</p><button type="button" class="secondary" data-show-candidate="${escapeHtml(question.id)}">Show in list</button></li>`
        )
        .join(
          ''
        )}</ul><p class="help">候補が同じ知識・判断基準を確認しているかは、作問者が最終判断してください。候補は自動選択されません。</p>`
    : '<p class="empty-state">Same choice set のUngrouped候補はありません。別のSeed Questionを選んでください。</p>';
  result.querySelectorAll('[data-show-candidate]').forEach((button) =>
    button.addEventListener('click', () => {
      state.createQuery = button.dataset.showCandidate;
      document.querySelector('#create-search').value = state.createQuery;
      renderCreateList();
      document
        .querySelector('#create-list')
        .scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    })
  );
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
    <section class="group-management" aria-labelledby="group-management-title"><h3 id="group-management-title">GROUP MANAGEMENT</h3><form id="rename-form" class="inline-form"><label>Group Name<input name="groupId" required></label><button type="submit">Rename Group</button></form>
    <button id="delete-group" type="button" class="danger">Delete Group</button><p class="help">Delete Groupは問題自体を削除しません。${members.length} questionsは残り、Ungrouped questionsへ戻ります。</p></section>
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
  comparisonNode.querySelector('#delete-group').addEventListener('click', () => {
    const groupId = state.selectedGroupId;
    if (
      !confirm(
        `Delete Variant Group "${groupId}"?\n\n${members.length} questions will remain and return to Ungrouped.`
      )
    )
      return;
    try {
      applyEdit(deleteVariantGroup(state.workingQuestions, groupId));
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
  renderCandidateAssist();
  renderSelected();
  renderValidation();
  renderCatalogFilters();
  renderCatalog();
}

document.querySelector('#catalog-tab').addEventListener('click', () => setWorkspace('catalog'));
document.querySelector('#variant-tab').addEventListener('click', () => setWorkspace('variant'));
document.querySelector('#catalog-search').addEventListener('input', (event) => {
  state.catalogFilters.keyword = event.target.value;
  renderCatalog();
});
document.querySelector('#catalog-filters').addEventListener('change', (event) => {
  const field = event.target.dataset.catalogFilter;
  if (!field) return;
  state.catalogFilters[field] = event.target.value;
  renderCatalog();
});
catalogListNode.addEventListener('click', (event) => {
  const button = event.target.closest('[data-question-id]');
  if (!button) return;
  state.selectedQuestionId = button.dataset.questionId;
  renderCatalog();
});

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
document.querySelector('#candidate-seed').addEventListener('change', (event) => {
  state.candidateSeedQuestionId = event.target.value;
  renderCandidateAssist();
});
document.querySelector('#create-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const data = new FormData(event.currentTarget);
    const groupId = data.get('groupId');
    const ids = data.getAll('questionIds');
    state.createQuery = '';
    state.candidateSeedQuestionId = '';
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
  state.candidateSeedQuestionId = '';
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
  state.selectedQuestionId = state.workingQuestions[0]?.id ?? null;
  state.validation = validateWorkingQuestions(state.workingQuestions);
  render();
  const groupCount = buildVariantGroupIndex(state.workingQuestions).length;
  statusNode.classList.add('status-success');
  statusNode.textContent = `読み込み完了: ${state.workingQuestions.length} questions / ${groupCount} variant groups`;
  document.querySelector('#create-form button[type="submit"]').disabled = false;
  document.querySelector('#catalog-search').disabled = false;
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
