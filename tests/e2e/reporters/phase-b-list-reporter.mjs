import path from 'node:path';

const failureStatuses = new Set(['failed', 'timedOut', 'interrupted']);
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
    const location = specFileName(test);
    console.log(
      `  ${mark} ${number} [${projectName(test)}] › ${title} › ${location}${resultSuffix(test, result)}`
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
