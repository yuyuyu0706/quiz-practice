# E2E Test Catalog

This catalog maps every Playwright E2E spec to the log-facing naming convention used in GitHub Actions.

## Naming convention

All E2E suites use the following `test.describe` format so Actions logs show the product, coverage type, feature, and screen at a glance:

```text
[DEP|DEA][UI|FLOW|DATA] Feature / Screen
```

- `UI`: visual rendering, controls, responsive layout, and visible states.
- `FLOW`: user journeys that move between screens or modes.
- `DATA`: persistence, storage, filtering, or data-integrity guarantees.
- Individual `test` names describe the guarantee being asserted.

## Catalog

| Spec                                            | Suite name                                      | Type | Guarantee(s)                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/e2e/dea-home.spec.ts`                    | `[DEA][UI] Home / Learning settings`            | UI   | Guarantees initial learning settings, mode options, and hidden resume controls render correctly.                                                       |
| `tests/e2e/dea-mobile.spec.ts`                  | `[DEA][FLOW] Quiz / Mobile controls`            | FLOW | Guarantees mobile secondary actions expand and quiz progress advances.                                                                                 |
| `tests/e2e/dea-quiz-flow.spec.ts`               | `[DEA][FLOW] Quiz / Desktop result`             | FLOW | Guarantees a desktop quiz can be completed from start to result summary.                                                                               |
| `tests/e2e/dea-resume.spec.ts`                  | `[DEA][FLOW] Resume / Suspend and restore`      | FLOW | Guarantees suspended progress resumes at the same answered question.                                                                                   |
| `tests/e2e/dep-home.spec.ts`                    | `[DEP][UI] Home / Learning settings`            | UI   | Guarantees DEP learning settings and home actions render without layout issues.                                                                        |
| `tests/e2e/dep-mobile.spec.ts`                  | `[DEP][FLOW] Quiz / Mobile controls`            | FLOW | Guarantees mobile secondary actions open and quiz progress advances.                                                                                   |
| `tests/e2e/dep-notes-bookmarks-coexist.spec.ts` | `[DEP][DATA] Notes / Bookmark coexistence`      | DATA | Guarantees note deletion preserves bookmarks and bookmark deletion preserves notes.                                                                    |
| `tests/e2e/dep-notes-bulk-delete.spec.ts`       | `[DEP][DATA] Notes / Bulk delete`               | DATA | Guarantees bulk note deletion preserves progress records.                                                                                              |
| `tests/e2e/dep-notes-list-mobile.spec.ts`       | `[DEP][UI] Notes / Mobile list`                 | UI   | Guarantees mobile note cards expose edit and delete actions.                                                                                           |
| `tests/e2e/dep-notes-list.spec.ts`              | `[DEP][DATA] Notes / Desktop CRUD`              | DATA | Guarantees note create, edit, and delete operations preserve progress data.                                                                            |
| `tests/e2e/dep-notes-review.spec.ts`            | `[DEP][FLOW] Review / Notes-only session`       | FLOW | Guarantees notes-only review starts with only questions that have notes.                                                                               |
| `tests/e2e/dep-quiz-flow.spec.ts`               | `[DEP][FLOW] Quiz / Desktop result`             | FLOW | Guarantees desktop quiz completion keeps progress, explanation, and result UI stable.                                                                  |
| `tests/e2e/dep-quiz-settings.spec.ts`           | `[DEP][DATA] Quiz settings / Session filters`   | DATA | Guarantees question-count and section filters are reflected in the active session order.                                                               |
| `tests/e2e/dep-result-review.spec.ts`           | `[DEP][FLOW] Review / Result entrypoint`        | FLOW | Guarantees the result screen can launch wrong-only review when wrong answers exist.                                                                    |
| `tests/e2e/dep-resume-cancel.spec.ts`           | `[DEP][FLOW] Resume / Cancel suspended session` | FLOW | Guarantees discarding a suspended session starts fresh progress.                                                                                       |
| `tests/e2e/dep-resume.spec.ts`                  | `[DEP][DATA] Resume / Storage restore`          | DATA | Guarantees DEP-specific storage keys save and restore suspended progress.                                                                              |
| `tests/e2e/dep-review-modes-mobile.spec.ts`     | `[DEP][FLOW] Review / Mobile mode navigation`   | FLOW | Guarantees mobile review mode controls are visible and navigable.                                                                                      |
| `tests/e2e/dep-review-modes.spec.ts`            | `[DEP][FLOW] Review / Desktop modes`            | FLOW | Guarantees bookmark-only and wrong-only review sessions filter correctly, and empty states appear for notes, bookmarks, and wrong-answer review modes. |
| `tests/e2e/dep-storage-resilience.spec.ts`      | `[DEP][DATA] Storage / Corruption recovery`     | DATA | Guarantees corrupted localStorage payloads are repaired, listed in the repair notice, and dismissible without crashing the app.                        |

## GitHub Actions log expectations

- Workflow step names are grouped by phase: `Prepare`, `Quality Gate`, and `Report`; E2E execution remains under the `Quality Gate: E2E:` prefix.
- E2E steps print the catalog path before running Playwright so maintainers can map failures to the documented intent.
- The custom Phase B reporter prints each result as `number [project] › suite › guarantee › spec-file`, so the purpose appears before the source location in Actions logs. Retry failures use the `↻` mark with `current/total status` retry details, and are summarized as recovered retry failures when the test passes on a later retry.
