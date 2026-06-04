export const STORAGE_KEYS = {
  progress: 'deaPlusQuizProgress',
  settings: 'deaPlusQuizSettings',
  session: 'deaPlusQuizActiveSession',
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
export function getRepairedStorageKeys() {
  return [...repairedStorageKeys];
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
  localStorage.setItem(key, JSON.stringify(value));
}
