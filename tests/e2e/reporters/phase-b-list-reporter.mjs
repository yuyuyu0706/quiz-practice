import path from 'node:path';

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

function fileLocation(test) {
  const file = path.relative(process.cwd(), test.location.file);
  return `${file}:${test.location.line}:${test.location.column}`;
}

function suiteAndTestTitle(test) {
  const titlePath = test.titlePath();
  const suiteTitles = titlePath.slice(3, -1);
  return [...suiteTitles, test.title].join(' › ');
}

function resultSuffix(result) {
  const duration = formatDuration(result.duration);
  return duration ? ` (${duration})` : '';
}

export default class PhaseBListReporter {
  #completed = 0;
  #total = 0;
  #workers = 0;
  #passed = 0;
  #failed = 0;
  #skipped = 0;
  #flaky = 0;

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

    if (result.status === 'skipped') {
      this.#skipped += 1;
    } else if (test.outcome() === 'flaky') {
      this.#flaky += 1;
    } else if (result.status === 'passed') {
      this.#passed += 1;
    } else {
      this.#failed += 1;
    }

    const mark = statusMarks[result.status] ?? '•';
    const number = String(this.#completed).padStart(3, ' ');
    const title = suiteAndTestTitle(test);
    const location = fileLocation(test);
    console.log(
      `  ${mark} ${number} [${projectName(test)}] › ${title} › ${location}${resultSuffix(result)}`
    );

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.log('');
        console.log(error.stack || error.message || String(error.value));
      }
    }
  }

  onEnd(result) {
    const parts = [];
    if (this.#failed) {
      parts.push(`${this.#failed} failed`);
    }
    if (this.#flaky) {
      parts.push(`${this.#flaky} flaky`);
    }
    if (this.#skipped) {
      parts.push(`${this.#skipped} skipped`);
    }
    if (this.#passed) {
      parts.push(`${this.#passed} passed`);
    }

    console.log(`\n  ${parts.join(', ') || result.status} (${formatDuration(result.duration)})`);
  }
}
