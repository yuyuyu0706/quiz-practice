# DEA Quiz App E2E Test Specification

## Overview

This directory stores the automated test specification and Playwright-based E2E tests for `dea-quiz-app`.
The current test foundation targets the following goals:

- validate that `dea-quiz-app/questions.json` keeps the expected structure
- verify the main quiz flow on desktop
- verify suspend/resume behavior
- verify the primary mobile flow and secondary action menu behavior
- keep the setup reusable for future expansion to `dep-quiz-app`

## Test Execution Entry Points

### Validation script

```bash
npm run validate:dea-questions
npm run validate:dep-questions
```

These commands run the shared validator (`scripts/validate-questions.mjs`) through the DEA / DEP entry points and check:

- JSON can be parsed
- required fields exist on every question
- `choices` contains exactly `A/B/C/D`
- `answer` is one of `A/B/C/D`
- `id` values are unique
- optional `references` entries have `title` and `url`
- optional metadata such as `domain`, `tags`, `difficulty`, `sourceType`, `whyWrong`, `notes`, `scenarioType`, and `estimatedTimeSec` satisfies the schema when present

### E2E tests

```bash
npm run test:e2e
```

Playwright settings are defined in `playwright.config.ts`.
The test runner automatically starts a local static server with `http-server` and runs against:

- `chromium`: desktop coverage (`1280 x 900`)
- `mobile-chrome`: mobile coverage (`375 x 812`)

Failure artifacts are retained as follows:

- trace: on first retry
- screenshot: only on failure
- video: retained on failure

## Current Test Files

### `tests/e2e/dea-home.spec.ts`

Purpose: verify the home screen renders correctly before quiz start.

Checks:

- app title is visible
- subtitle is visible
- section checkboxes are rendered
- mode radio buttons are rendered
- resume/discard buttons are hidden when no suspended session exists

### `tests/e2e/dea-quiz-flow.spec.ts`

Purpose: verify the primary desktop flow from start to results.

Scope:

- runs only on the `chromium` project
- starts a 10-question quiz
- answers the first question
- confirms grading feedback is shown
- confirms explanation is opened
- moves through all questions with `#next-question`
- verifies the result screen and score summary

### `tests/e2e/dea-resume.spec.ts`

Purpose: verify suspend/resume behavior on desktop.

Scope:

- runs only on the `chromium` project
- starts a 10-question quiz
- answers at least one question
- suspends to home
- confirms `続きから再開` is shown
- resumes the existing session
- confirms the answered state and explanation remain visible
- confirms the quiz can advance to the next question

### `tests/e2e/dea-mobile.spec.ts`

Purpose: verify the essential mobile flow and secondary action menu behavior.

Scope:

- runs only on the `mobile-chrome` project
- starts a 10-question quiz on mobile viewport
- confirms the `その他の操作` toggle is visible
- confirms the toggle can be opened
- confirms `中断してホームへ` is accessible in the mobile layout
- answers a question
- confirms the main next button is visible
- advances to the next question

### `tests/e2e/helpers.ts`

Shared helpers used across specs:

- `gotoDeaHome(page)`: opens the DEA app and verifies the initial headings
- `startQuiz(page, count)`: starts a quiz with a given question count
- `answerCurrentQuestion(page)`: answers the current question using the first choice and verifies grading/explanation

## Selector Policy

To reduce flakiness, tests prefer the following in order:

1. stable IDs such as `#next-question`
2. role-based selectors for unique buttons and headings
3. structural selectors only when the DOM is already stable and simple

The current tests intentionally avoid full text matching for question contents so that quiz data can change without breaking the main flow tests.

## CI Relationship

GitHub Actions uses the same commands as local execution:

1. install dependencies
2. install Playwright browsers
3. run `npm run validate:dea-questions`
4. run `npm run validate:dep-questions`
5. run `npm run test:e2e`
6. upload `playwright-report` and `test-results`

## Future Expansion Candidates

Recommended additions for later phases:

- bookmark mode flow
- wrong-only mode flow
- visual snapshot coverage for home / quiz / result screens
- `dep-quiz-app` expansion using the same helper and config pattern
- stronger data validation such as URL format or section value constraints
