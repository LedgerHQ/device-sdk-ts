---
name: review-dependency-updates
description: Reviews the open Dependabot PRs of device-sdk-ts — reports green PRs as ready to merge, triages red CI before taking action, makes small version-bump fixes for human review, and posts a report in Slack. Use when asked to review, handle or triage dependency update PRs.
alwaysApply: false
---

# Review dependency updates

Adapted from the Cloud Wallet `review-dependency-updates` skill
(LedgerHQ/team-cloud-wallet-koda). Differences: Dependabot only, no Jira
maintenance epic, no merging (bot approvals never count on `develop`), and the
Slack channel comes from the run prompt.

**Time budget:** the run is stopped after about 85 minutes. Do not start working on a new PR (rebase, re-run, fix) once
60 minutes have passed: list the remaining PRs in the report as `:fast_forward:` "time budget — next run". Always keep
time to post the Slack report.

## Step 1 — List the dependency update PRs

List the open, non-draft pull requests targeting `develop` authored by `dependabot[bot]`. Ignore every other PR.
If there is none, stop here — post nothing and finish.

## Step 2 — Classify each PR

For each PR, determine:

- **Update level:** compare the versions in the title/body. Treat a grouped PR as **major** if any update in it is major
  or a pre-release. If unsure, treat it as major.
- **Superseded:** another open PR updates the same dependency (or group) to a newer version. Do not act on superseded
  PRs, only list them in the report.
- **Touched by a human:** the PR has substantive commits not authored by Dependabot or by you. Ignore a merge commit
  that only merges `develop` into the PR branch. Do not act on PRs with other human-authored commits; list them in the
  report.
- **Tracked in Jira:** if the PR title or body contains a Jira issue key or URL (other than `NO-ISSUE`), do not act on
  it and leave it out of the report.

## Step 3 — Check branch currency and CI status

For each remaining PR, inspect the CI checks of its latest commit. If the branch is behind `develop`, do **not** update
it merely because it is stale. Update it (ask Dependabot with a `@dependabot rebase` comment) only when the `develop`
changes since the merge base plausibly affect this bump: same dependency declaration, `pnpm-lock.yaml`,
`pnpm-workspace.yaml` catalog, `.prototools`, turbo/build/CI configuration, or code that the upgraded dependency
directly uses. Record why.

- **Expected checks:** use the required status checks of the `develop` ruleset. `Human approval` is expected to be
  skipped or pending on Dependabot PRs; never count it as a failure.
- If some checks are still running, wait for them. If they are still running after 30 minutes, skip the PR and mention
  it in the report.
- If CI is red, read the failed-job logs and analyze the cause **before** re-running, rebasing or fixing anything. A
  failure is pre-existing only when its logs show the same failing test or error on `develop`.
- Re-run a failed job only when it is a flaky **test** failure that has also occurred on another PR of this repository.
  Verify that history before re-running the failed job once. Never re-run build, typecheck, lint,
  dependency-resolution, infrastructure or credential failures.

## Step 4 — Report green PRs

Do not merge, approve or enqueue any PR: merging `develop` requires a human approval. A PR that is green on its current
head (all required checks pass, or only demonstrably pre-existing failures) is reported as ready to merge.

## Step 5 — Fix red CI caused by the version bump

Only after Step 3 establishes that the version bump caused the failure, fix it when the fix is small and mechanical,
for example:

- Renamed or moved imports, or a renamed/re-typed API whose replacement is given in the release notes or migration
  guide
- A dependency-resolution collision or a stale `pnpm-lock.yaml` (`pnpm install`, then `pnpm dedupe`)
- New lint or type errors introduced by an eslint, typescript-eslint or typescript update
- Formatting changes introduced by a prettier update (run the formatter and commit the result)

Do **not** fix it — only report the analysis — if it requires behavior, business-logic or test-expectation changes;
needs a substantial major-version migration; touches more than ~10 files; or is not clearly correct.

When you fix code, run the `setup`, `lint`, `typecheck` and `test` commands from `koda.yaml` before pushing. Push one
commit on the PR branch following the `commit` skill (for example, `⬆️ (repo): Adapt to vitest 4 API`). If the fix
changes the code of a published package, add a patch changeset following the `changeset` skill. Stop and report if CI
remains red after `max_fix_attempts` attempts (from `koda.yaml`, default 1).

## Step 6 — Post a report in Slack

Call `postChannelMessage` exactly once, on the channel given in the run prompt, with:

- The repository name, then one bullet per PR: the PR link, followed by a status emoji. Add a short comment after the
  emoji only when there is something a human needs to know.

  | Emoji                | Status                                                                  | Comment                                                                 |
  | -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
  | `:white_check_mark:` | Green, ready for a human approval and merge                             | none                                                                    |
  | `:eyes:`             | A version-bump failure received a proposed fix; review needed           | the issue and the fix proposed                                          |
  | `:x:`                | Blocked                                                                 | which checks failed, whether new, the cause; say when unrelated to bump |
  | `:fast_forward:`     | Skipped (CI still running, superseded, touched by a human, time budget) | the reason, in a few words                                              |

  - If a check only passed after a re-run, name it and say it was rerun due to flaky red CI.
  - Keep comments to one short sentence, and order the bullets by emoji, in the order of the table.

  Example:

  ```
  *device-sdk-ts* — dependency updates
  - <https://github.com/LedgerHQ/device-sdk-ts/pull/101|#101 Bump vite from 7.3.6 to 7.3.7> :white_check_mark:
  - <https://github.com/LedgerHQ/device-sdk-ts/pull/102|#102 Bump the eslint group with 3 updates> :eyes: new `no-unused-vars` errors fixed; review needed
  - <https://github.com/LedgerHQ/device-sdk-ts/pull/103|#103 Bump electron from 39 to 42> :x: `build` fails in sample-desktop; major migration needed
  ```

Do not post the message if no PR was found in Step 1. Author every link as Slack mrkdwn `<url|label>`, not Markdown.
