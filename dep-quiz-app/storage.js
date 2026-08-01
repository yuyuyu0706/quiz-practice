import {
  createConfidenceAttempt,
  createEmptyConfidenceHistory,
  normalizeConfidenceHistory,
} from './confidence-history.js';
import { buildConfidenceHistoryRepairPlan } from './confidence-history-repair.js';

export const STORAGE_KEYS = {
  progress: 'depQuizProgress',
  confidenceHistory: 'depQuizConfidenceHistory',
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
export function loadConfidenceHistoryState({ storage = globalThis.localStorage } = {}) {
  const raw = storage.getItem(STORAGE_KEYS.confidenceHistory);
  if (raw === null) {
    const history = createEmptyConfidenceHistory();
    saveJSONToStorage(storage, STORAGE_KEYS.confidenceHistory, history);
    return stateResult(history, 'initialized');
  }

  let parsed;
  try {
    if (raw === '') throw new Error('Empty storage value');
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const plan = buildConfidenceHistoryRepairPlan(parsed);
  if (plan.status === 'unsupported') {
    return stateResult(createEmptyConfidenceHistory(), 'unsupported', plan);
  }
  if (plan.shouldWriteBack) {
    saveJSONToStorage(storage, STORAGE_KEYS.confidenceHistory, plan.nextHistory);
    recordStorageRepair(STORAGE_KEYS.confidenceHistory);
    return stateResult(plan.nextHistory, 'repaired', plan);
  }
  return stateResult(plan.nextHistory, 'ready', plan);
}
export function loadConfidenceHistory() {
  return loadConfidenceHistoryState().history;
}
export function saveConfidenceHistory(history) {
  saveJSON(STORAGE_KEYS.confidenceHistory, history);
}

export function commitConfidenceAnswer(plan, { storage = globalThis.localStorage } = {}) {
  validateConfidenceAnswerPlan(plan);

  const progressSnapshot = readRawStorageValue(storage, STORAGE_KEYS.progress);
  const historySnapshot = readRawStorageValue(storage, STORAGE_KEYS.confidenceHistory);
  const currentHistory = parseRawJSON(historySnapshot);
  const currentPlan = buildConfidenceHistoryRepairPlan(currentHistory);
  if (currentPlan.status === 'unsupported') {
    throw new UnsupportedConfidenceHistoryVersionError(currentPlan.unsupportedVersion);
  }

  try {
    saveJSONToStorage(storage, STORAGE_KEYS.progress, plan.nextProgress);
  } catch (error) {
    throw createCommitStorageError('Failed to save confidence answer progress', error, [
      restoreRawStorageValue(storage, STORAGE_KEYS.progress, progressSnapshot),
    ]);
  }

  try {
    saveJSONToStorage(storage, STORAGE_KEYS.confidenceHistory, plan.nextHistory);
  } catch (error) {
    throw createCommitStorageError('Failed to save confidence answer history', error, [
      restoreRawStorageValue(storage, STORAGE_KEYS.progress, progressSnapshot),
      restoreRawStorageValue(storage, STORAGE_KEYS.confidenceHistory, historySnapshot),
    ]);
  }

  return {
    attempt: plan.attempt,
    nextProgress: plan.nextProgress,
    nextHistory: plan.nextHistory,
    trimmedCount: plan.trimmedCount,
  };
}
export class UnsupportedConfidenceHistoryVersionError extends Error {
  constructor(version) {
    super(`Unsupported confidence history version: ${version}`);
    this.name = 'UnsupportedConfidenceHistoryVersionError';
    this.code = 'UNSUPPORTED_CONFIDENCE_HISTORY_VERSION';
    this.version = version;
  }
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
  const historySnapshot = readRawStorageValue(storage, STORAGE_KEYS.confidenceHistory);
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

  try {
    saveJSONToStorage(storage, STORAGE_KEYS.confidenceHistory, plan.nextHistory);
  } catch (error) {
    throw createCommitStorageError('Failed to save learning history reset history', error, [
      restoreRawStorageValue(storage, STORAGE_KEYS.progress, progressSnapshot),
      restoreRawStorageValue(storage, STORAGE_KEYS.confidenceHistory, historySnapshot),
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
          restoreRawStorageValue(storage, STORAGE_KEYS.confidenceHistory, historySnapshot),
          restoreRawStorageValue(storage, STORAGE_KEYS.session, sessionSnapshot),
        ]
      );
    }
  }

  return {
    nextProgress: plan.nextProgress,
    nextHistory: plan.nextHistory,
    didClearConfidenceHistory: plan.confidenceHistory.shouldClear,
    didClearActiveSession: plan.activeSession.shouldClear,
  };
}
export function getRepairedStorageKeys() {
  return [...repairedStorageKeys];
}

function validateLearningHistoryResetPlan(plan) {
  const emptyHistory = createEmptyConfidenceHistory();
  if (
    !isPlainObject(plan) ||
    !isPlainObject(plan.nextProgress) ||
    JSON.stringify(plan.nextHistory) !== JSON.stringify(emptyHistory) ||
    !isPlainObject(plan.confidenceHistory) ||
    typeof plan.confidenceHistory.shouldClear !== 'boolean' ||
    !isPlainObject(plan.activeSession) ||
    typeof plan.activeSession.shouldClear !== 'boolean'
  ) {
    throw new TypeError('Invalid learning history reset plan');
  }
}

function stateResult(history, status, plan = {}) {
  return {
    history,
    status,
    unsupportedVersion: plan.unsupportedVersion ?? null,
    removedAttemptCount: plan.removedAttemptCount ?? 0,
  };
}

function parseRawJSON(raw) {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validateConfidenceAnswerPlan(plan) {
  if (
    !isPlainObject(plan) ||
    !isPlainObject(plan.nextProgress) ||
    !isPlainObject(plan.nextHistory) ||
    !Number.isInteger(plan.trimmedCount) ||
    plan.trimmedCount < 0
  ) {
    throw new TypeError('Invalid confidence answer commit plan');
  }

  let canonicalAttempt;
  try {
    canonicalAttempt = createConfidenceAttempt(plan.attempt);
  } catch {
    throw new TypeError('Invalid confidence answer commit plan');
  }
  const canonicalHistory = normalizeConfidenceHistory(plan.nextHistory);
  if (
    JSON.stringify(canonicalAttempt) !== JSON.stringify(plan.attempt) ||
    JSON.stringify(canonicalHistory) !== JSON.stringify(plan.nextHistory) ||
    !canonicalHistory.attempts.some(({ attemptId }) => attemptId === canonicalAttempt.attemptId)
  ) {
    throw new TypeError('Invalid confidence answer commit plan');
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
