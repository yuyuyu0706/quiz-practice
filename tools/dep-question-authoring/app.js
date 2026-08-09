import {
  buildVariantComparison,
  buildVariantGroupIndex,
  searchVariantGroups,
} from './variant-authoring.js';
import { inspectVariantSelection } from './variant-inspector.js';

const state = {
  questions: [],
  selectedGroupId: null,
  query: '',
  mode: 'normal',
  sections: [],
  progress: {},
};
const groupsNode = document.querySelector('#groups');
const comparisonNode = document.querySelector('#comparison');
const inspectorNode = document.querySelector('#inspector');
const statusNode = document.querySelector('#status');

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

function renderGroups() {
  const groups = searchVariantGroups(state.questions, state.query);
  groupsNode.innerHTML =
    groups
      .map(
        (group) =>
          `<button data-group="${escapeHtml(group.id)}" class="${group.id === state.selectedGroupId ? 'active' : ''}">${escapeHtml(group.id)} <span class="badge">${group.members.length}</span></button>`
      )
      .join('') || '<p class="meta">該当するグループはありません。</p>';
}

function renderSelected() {
  const members = state.questions.filter(
    (question) => question.variantGroup === state.selectedGroupId
  );
  if (!members.length) return;
  const comparison = buildVariantComparison(members);
  comparisonNode.hidden = false;
  comparisonNode.innerHTML = `<p class="eyebrow">MEMBER COMPARISON</p><h2>${escapeHtml(state.selectedGroupId)} <span class="badge">${members.length} members</span></h2><div class="cards">${comparison
    .map(
      (item) =>
        `<article class="card"><h3>${escapeHtml(item.id)}</h3><p class="meta">Section ${escapeHtml(item.section)} · ${escapeHtml(item.sectionTitle)} · ${escapeHtml(item.difficulty)}</p><p>${escapeHtml(item.question)}</p><p><strong>Answer:</strong> ${escapeHtml(item.answer)}</p><ol class="choices">${Object.entries(
          item.choices
        )
          .map(([label, text]) => `<li>${escapeHtml(label)}: ${escapeHtml(text)}</li>`)
          .join(
            ''
          )}</ol><p class="meta"><strong>Choice text multiset</strong><br>${item.choiceTextMultiset.map(escapeHtml).join(' · ')}</p><p class="meta"><strong>Follow-up:</strong> ${escapeHtml(item.followUpTargetId ?? 'なし')}</p></article>`
    )
    .join('')}</div>`;
  renderInspector(members);
}

function renderInspector(members) {
  inspectorNode.hidden = false;
  inspectorNode.innerHTML = `<p class="eyebrow">SELECTION INSPECTOR · MEMORY ONLY</p><h2>代表選択を診断</h2><div class="controls"><label>Mode<select id="mode">${['normal', 'random', 'wrongOnly', 'bookmarks', 'notesOnly'].map((mode) => `<option ${mode === state.mode ? 'selected' : ''}>${mode}</option>`).join('')}</select></label><label>Section<select id="section"><option value="all">すべて</option>${[...new Set(state.questions.map((q) => q.section))].map((section) => `<option ${state.sections.length === 1 && state.sections[0] === section ? 'selected' : ''}>${escapeHtml(section)}</option>`).join('')}</select></label></div><div class="progress-grid"><strong>Member</strong><span>seen</span><span>wrong</span><span>bookmark</span><span>note</span>${members
    .map((member) => {
      const p = state.progress[member.id] ?? {};
      return `<strong>${escapeHtml(member.id)}</strong><input data-id="${member.id}" data-field="seenCount" type="number" min="0" value="${p.seenCount ?? 0}"><input data-id="${member.id}" data-field="wrongCount" type="number" min="0" value="${p.wrongCount ?? 0}"><input data-id="${member.id}" data-field="bookmark" type="checkbox" ${p.bookmark ? 'checked' : ''}><input data-id="${member.id}" data-field="noteText" value="${escapeHtml(p.noteText ?? '')}" aria-label="${member.id} note"></input>`;
    })
    .join('')}</div><div id="result" class="result"></div>`;
  inspectorNode.querySelector('#mode').addEventListener('change', (event) => {
    state.mode = event.target.value;
    updateResult();
  });
  inspectorNode.querySelector('#section').addEventListener('change', (event) => {
    state.sections =
      event.target.value === 'all'
        ? [...new Set(state.questions.map((q) => q.section))]
        : [event.target.value];
    updateResult();
  });
  inspectorNode.querySelectorAll('[data-field]').forEach((input) =>
    input.addEventListener('input', () => {
      const p = (state.progress[input.dataset.id] ??= {});
      p[input.dataset.field] =
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
    questions: state.questions,
    groupId: state.selectedGroupId,
    settings: { sections: state.sections },
    mode: state.mode,
    progress: state.progress,
  });
  document.querySelector('#result').innerHTML =
    `<strong>Winner: ${escapeHtml(result.winnerId ?? 'なし')}</strong>${result.randomBoundary ? `<p>${escapeHtml(result.randomBoundary)}</p>` : ''}<ul>${result.members.map((item) => `<li class="${item.selected ? 'selected' : item.eligible ? '' : 'excluded'}">${escapeHtml(item.id)} — ${escapeHtml(item.reason)}</li>`).join('')}</ul>`;
}

groupsNode.addEventListener('click', (event) => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  state.selectedGroupId = button.dataset.group;
  renderGroups();
  renderSelected();
});
document.querySelector('#search').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderGroups();
});

try {
  const response = await fetch('/dep-quiz-app/questions.json');
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  state.questions = await response.json();
  state.sections = [...new Set(state.questions.map((q) => q.section))];
  state.selectedGroupId = buildVariantGroupIndex(state.questions)[0]?.id ?? null;
  statusNode.remove();
  renderGroups();
  renderSelected();
} catch (error) {
  statusNode.textContent = `読み込みに失敗しました: ${error.message}`;
}
