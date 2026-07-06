const RESET_ENTRY_KEYS = new Set([
  'seenCount',
  'correctCount',
  'wrongCount',
  'lastAnsweredAt',
  'wrongReasonTags',
  'wrongReasonUpdatedAt',
]);

const OPTIONAL_EMPTY_RETAINED_VALUES = {
  bookmark: false,
  noteUpdatedAt: null,
};
const OPTIONAL_NOTE_KEYS = new Set(['noteText', 'note', 'memo']);

export function buildLearningHistoryResetPlan(progress, { activeSession = null } = {}) {
  const safeProgress = isPlainObject(progress) ? progress : {};
  const nextProgress = {};
  const hasActiveSession = activeSession != null;
  const impact = {
    resetQuestionCount: 0,
    changedEntryCount: 0,
    retainedNoteCount: 0,
    retainedBookmarkCount: 0,
    removedEntryCount: 0,
    retainedEntryCount: 0,
    hasActiveSession,
  };

  Object.entries(safeProgress).forEach(([questionId, entry]) => {
    if (!isPlainObject(entry)) {
      nextProgress[questionId] = entry;
      impact.retainedEntryCount += 1;
      return;
    }

    if (hasMeaningfulResetTarget(entry)) {
      impact.resetQuestionCount += 1;
    }
    if (hasResetEntryKey(entry)) {
      impact.changedEntryCount += 1;
    }

    const nextEntry = removeResetTargetKeys(entry);
    if (isEmptyRetainedEntry(nextEntry)) {
      impact.removedEntryCount += 1;
      return;
    }

    nextProgress[questionId] = nextEntry;
    impact.retainedEntryCount += 1;
    if (hasNonEmptyNote(nextEntry)) {
      impact.retainedNoteCount += 1;
    }
    if (nextEntry.bookmark === true) {
      impact.retainedBookmarkCount += 1;
    }
  });

  return {
    nextProgress,
    impact,
    activeSession: {
      shouldClear: hasActiveSession,
    },
  };
}

function removeResetTargetKeys(entry) {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !RESET_ENTRY_KEYS.has(key)));
}

function hasResetEntryKey(entry) {
  return [...RESET_ENTRY_KEYS].some((key) => Object.hasOwn(entry, key));
}

function hasMeaningfulResetTarget(entry) {
  return (
    hasPositiveCount(entry.seenCount) ||
    hasPositiveCount(entry.correctCount) ||
    hasPositiveCount(entry.wrongCount) ||
    entry.lastAnsweredAt != null ||
    hasWrongReasonTags(entry.wrongReasonTags) ||
    entry.wrongReasonUpdatedAt != null
  );
}

function hasPositiveCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function hasWrongReasonTags(value) {
  return Array.isArray(value) ? value.length > 0 : value != null;
}

function isEmptyRetainedEntry(entry) {
  return Object.entries(entry).every(([key, value]) => {
    if (OPTIONAL_NOTE_KEYS.has(key)) {
      return String(value ?? '').trim().length === 0;
    }
    if (!Object.hasOwn(OPTIONAL_EMPTY_RETAINED_VALUES, key)) return false;
    return value === OPTIONAL_EMPTY_RETAINED_VALUES[key];
  });
}

function hasNonEmptyNote(entry) {
  return ['noteText', 'note', 'memo'].some((key) => String(entry[key] ?? '').trim().length > 0);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
