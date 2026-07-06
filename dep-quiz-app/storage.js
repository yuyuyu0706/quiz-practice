export const STORAGE_KEYS = {
  progress: 'depQuizProgress',
  settings: 'depQuizSettings',
  session: 'depQuizActiveSession',
};

const DEFAULT_SETTINGS = {
  sections: ['1', '2', '3', '4', '5'],
  mode: 'normal',
  count: '50',
};

const repairedStorageKeys = new Set();

export function loadProgress() {
  return loadJSON(STORAGE_KEYS.progress, {});
}
export function saveProgress(progress) {
  saveJSON(STORAGE_KEYS.progress, progress);
}
export function loadSettings() {
  return loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}
export function saveSettings(settings) {
  saveJSON(STORAGE_KEYS.settings, settings);
}
export function loadActiveSession() {
  return loadJSON(STORAGE_KEYS.session, null);
}
export function saveActiveSession(session) {
  saveJSON(STORAGE_KEYS.session, session);
}
export function clearActiveSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}
export function commitLearningHistoryReset(plan, { storage = globalThis.localStorage } = {}) {
  validateLearningHistoryResetPlan(plan);

  const progressSnapshot = readRawStorageValue(storage, STORAGE_KEYS.progress);
  const sessionSnapshot = plan.activeSession.shouldClear
    ? readRawStorageValue(storage, STORAGE_KEYS.session)
    : null;

  try {
    saveJSONToStorage(storage, STORAGE_KEYS.progress, plan.nextProgress);
  } catch (error) {
    throw createCommitStorageError('Failed to save learning history reset progress', error, [
      restoreRawStorageValue(storage, STORAGE_KEYS.progress, progressSnapshot),
    ]);
  }

  if (plan.activeSession.shouldClear) {
    try {
      storage.removeItem(STORAGE_KEYS.session);
    } catch (error) {
      throw createCommitStorageError(
        'Failed to clear active session for learning history reset',
        error,
        [
          restoreRawStorageValue(storage, STORAGE_KEYS.progress, progressSnapshot),
          restoreRawStorageValue(storage, STORAGE_KEYS.session, sessionSnapshot),
        ]
      );
    }
  }

  return {
    nextProgress: plan.nextProgress,
    didClearActiveSession: plan.activeSession.shouldClear,
  };
}
export function getRepairedStorageKeys() {
  return [...repairedStorageKeys];
}

function validateLearningHistoryResetPlan(plan) {
  if (
    !isPlainObject(plan) ||
    !isPlainObject(plan.nextProgress) ||
    !isPlainObject(plan.activeSession) ||
    typeof plan.activeSession.shouldClear !== 'boolean'
  ) {
    throw new TypeError('Invalid learning history reset plan');
  }
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function readRawStorageValue(storage, key) {
  return storage.getItem(key);
}

function restoreRawStorageValue(storage, key, rawValue) {
  try {
    if (rawValue === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, rawValue);
    }
    return null;
  } catch (error) {
    return { key, error };
  }
}

function createCommitStorageError(message, cause, restoreResults) {
  const error = new Error(message, { cause });
  error.restoreFailures = restoreResults.filter(Boolean);
  return error;
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      if (fallback !== null) {
        saveJSON(key, fallback);
      }
      return fallback;
    }

    if (value === '') {
      throw new Error('Empty storage value');
    }

    const parsed = JSON.parse(value);
    if (!isValidStoredJSON(parsed, fallback)) {
      throw new Error('Invalid JSON structure');
    }

    return parsed;
  } catch {
    saveJSON(key, fallback);
    recordStorageRepair(key);
    return fallback;
  }
}

function isValidStoredJSON(value, fallback) {
  if (fallback === null && value === null) return true;
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordStorageRepair(key) {
  repairedStorageKeys.add(key);
}

function saveJSON(key, value) {
  saveJSONToStorage(localStorage, key, value);
}

function saveJSONToStorage(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}
