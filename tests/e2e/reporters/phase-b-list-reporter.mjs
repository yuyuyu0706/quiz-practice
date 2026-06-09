import path from 'node:path';

const failureStatuses = new Set(['failed', 'timedOut', 'interrupted']);

const caseLabels = new Map([
  [
    'guarantees initial learning settings, modes, and hidden resume controls are visible states',
    'initial-settings',
  ],
  ['guarantees mobile secondary actions expand and quiz progress advances', 'mobile-actions'],
  ['guarantees a desktop quiz can be completed from start to result summary', 'complete-result'],
  ['guarantees suspended progress resumes at the same answered question', 'resume-progress'],
  ['guarantees DEA Plus note create restore and delete preserves progress data', 'plus-note-crud'],
  [
    'guarantees DEA Plus notes-only review includes only questions with saved notes',
    'plus-notes-only',
  ],
  ['guarantees DEA Plus mobile notes controls remain usable after answering', 'plus-mobile-notes'],
  ['guarantees DEP learning settings and home actions render without layout issues', 'home-layout'],
  ['guarantees mobile secondary actions open and quiz progress advances', 'mobile-actions'],
  [
    'guarantees desktop note textarea keeps multiline drafts and suppresses quiz shortcuts',
    'note-keyboard',
  ],
  ['guarantees desktop quiz shortcuts still work while choice radio has focus', 'radio-shortcuts'],
  [
    'guarantees answered question Enter does not double count progress while note is focused',
    'note-enter-count',
  ],
  ['guarantees mobile note textarea keeps multiline drafts', 'mobile-note-keyboard'],
  [
    'guarantees note deletion preserves bookmarks and bookmark deletion preserves notes',
    'note-bookmark',
  ],
  ['guarantees bulk note deletion preserves progress records', 'bulk-delete'],
  ['guarantees mobile note cards expose edit and delete actions', 'mobile-crud'],
  ['guarantees note create edit delete preserves progress data', 'desktop-crud'],
  ['guarantees notes-only review starts with only questions that have notes', 'notes-only'],
  [
    'guarantees desktop quiz completion keeps progress explanation and result UI stable',
    'complete-result',
  ],
  ['guarantees question count setting limits active session order length', 'count-limit'],
  ['guarantees section filter limits active session to the selected section', 'section-filter'],
  [
    'guarantees result screen can launch wrong-only review when wrong answers exist',
    'result-wrong',
  ],
  ['guarantees discarding a suspended session starts fresh progress', 'discard-resume'],
  ['guarantees DEP-specific storage keys save and restore suspended progress', 'storage-resume'],
  ['guarantees mobile review mode controls are visible and navigable', 'mobile-review'],
  ['guarantees bookmark-only review includes only bookmarked questions', 'bookmark-only'],
  ['guarantees wrong-only review includes only questions with wrong answer history', 'wrong-only'],
  ['guarantees notes-only review empty state appears when no notes exist', 'notes-empty'],
  ['guarantees bookmark-only review empty state appears when no bookmarks exist', 'bookmark-empty'],
  ['guarantees wrong-only review empty state appears when no wrong answers exist', 'wrong-empty'],
  ['guarantees corrupted localStorage payloads recover without app crash', 'all-key-repair'],
  ['guarantees corrupted progress data repair shows the repaired key', 'progress-repair'],
  ['guarantees multiple corrupted storage keys are repaired and listed', 'multi-key-repair'],
  ['guarantees storage repair notice can be dismissed', 'dismiss-notice'],
]);

const statusMarks = {
  passed: '✓',
  failed: '✘',
  timedOut: '✘',
  skipped: '-',
  interrupted: '✘',
};

function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds <= 0) {
    return '';
  }

  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function projectName(test) {
  return test.parent.project()?.name ?? 'unknown-project';
}

function specFileName(test) {
  return path.basename(test.location.file);
}

function caseLabel(test) {
  return caseLabels.get(test.title) ?? 'case';
}

function suiteTitle(test) {
  const titlePath = test.titlePath();
  return titlePath.slice(3, -1).join(' › ');
}

function isRetryFailure(test, result) {
  return failureStatuses.has(result.status) && result.retry < test.retries;
}

function resultMark(test, result) {
  if (isRetryFailure(test, result)) {
    return '↻';
  }

  return statusMarks[result.status] ?? '•';
}

function resultSuffix(test, result) {
  const parts = [];

  if (test.retries > 0) {
    parts.push(`${result.retry + 1}/${test.retries + 1} ${result.status}`);
  }

  const duration = formatDuration(result.duration);
  if (duration) {
    parts.push(duration);
  }

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function countRecoveredRetryFailures(test) {
  if (test.outcome() !== 'flaky') {
    return 0;
  }

  return test.results.filter((result) => failureStatuses.has(result.status)).length;
}

export default class PhaseBListReporter {
  #completed = 0;
  #total = 0;
  #workers = 0;
  #tests = new Map();

  printsToStdio() {
    return true;
  }

  onBegin(config, suite) {
    this.#total = suite.allTests().length;
    this.#workers = config.workers;
    console.log(`\nRunning ${this.#total} tests using ${this.#workers} workers\n`);
  }

  onStdOut(chunk) {
    process.stdout.write(chunk);
  }

  onStdErr(chunk) {
    process.stderr.write(chunk);
  }

  onTestEnd(test, result) {
    this.#completed += 1;
    this.#tests.set(test.id, test);

    const mark = resultMark(test, result);
    const number = String(this.#completed).padStart(3, ' ');
    const title = suiteTitle(test);
    const label = caseLabel(test);
    const location = specFileName(test);
    console.log(
      `  ${mark} ${number} [${projectName(test)}] › ${title} › ${label} › ${location}${resultSuffix(test, result)}`
    );

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.log('');
        console.log(error.stack || error.message || String(error.value));
      }
    }
  }

  onEnd(result) {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let flaky = 0;
    let recoveredRetryFailures = 0;

    for (const test of this.#tests.values()) {
      switch (test.outcome()) {
        case 'skipped':
          skipped += 1;
          break;
        case 'flaky':
          flaky += 1;
          recoveredRetryFailures += countRecoveredRetryFailures(test);
          break;
        case 'unexpected':
          failed += 1;
          break;
        case 'expected':
          passed += 1;
          break;
      }
    }

    const parts = [];
    if (failed) {
      parts.push(`${failed} failed`);
    }
    if (flaky) {
      const retryNote = recoveredRetryFailures
        ? ` (${recoveredRetryFailures} recovered retry failures)`
        : '';
      parts.push(`${flaky} flaky${retryNote}`);
    }
    if (skipped) {
      parts.push(`${skipped} skipped`);
    }
    if (passed) {
      parts.push(`${passed} passed`);
    }

    console.log(`\n  ${parts.join(', ') || result.status} (${formatDuration(result.duration)})`);
  }
}
