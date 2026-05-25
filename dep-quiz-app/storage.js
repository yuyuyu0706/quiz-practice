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

export function loadProgress() { return loadJSON(STORAGE_KEYS.progress, {}); }
export function saveProgress(progress) { saveJSON(STORAGE_KEYS.progress, progress); }
export function loadSettings() { return loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS); }
export function saveSettings(settings) { saveJSON(STORAGE_KEYS.settings, settings); }
export function loadActiveSession() { return loadJSON(STORAGE_KEYS.session, null); }
export function saveActiveSession(session) { saveJSON(STORAGE_KEYS.session, session); }
export function clearActiveSession() { localStorage.removeItem(STORAGE_KEYS.session); }

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
