// Upgrades Lumen to latest and opens a PR (Lumen ADR 027). Owned by the Lumen team.
// @ts-nocheck: @cairn/plan is provided by Cairn at run time, not installed here
import {
  agent,
  allTools,
  plan,
  retryShellSlot,
  task,
  variable,
} from "@cairn/plan";
import { z } from "zod";

// Danger requires `<type>/no-issue-<description>`; `createBranch` appends a unique suffix.
const branchPrefix = "chore/no-issue-lumen-upgrade";

// Lumen versions are pinned in each package.json, outside the pnpm catalog.
const lumenManifests =
  'grep -rlE --include=package.json --exclude-dir=node_modules \'"@ledgerhq/lumen-[a-z-]+": "[0-9]\' apps packages';

// The bump touches every package that pins Lumen, so check them and their dependents.
// Lint and typecheck hashes leave out external dependencies, so a cached result would predate the bump.
const verifyCommand =
  "git fetch --quiet origin develop && pnpm turbo run lint typecheck --filter='...[origin/develop]' --force";

const prUrl = variable("prUrl", z.string().url(), {
  description: "Pull request URL opened by the upgrade.",
});

const result = variable(
  "result",
  z.discriminatedUnion("status", [
    z.object({
      status: z.literal("pr-created"),
      summary: z.string().describe("What the upgrade changed."),
      prUrl: z.string().url(),
    }),
    z.object({
      status: z.literal("skipped"),
      reason: z.string().describe("Why no PR was opened."),
    }),
    z.object({
      status: z.literal("failed"),
      reason: z.string().describe("The failing step."),
    }),
  ]),
  { description: "Terminal result returned by run-plan." },
);

const verify = retryShellSlot("verify");

const upgrader = agent("upgrader")
  .prompt(
    `You upgrade the @ledgerhq/lumen-* packages in device-sdk-ts.
Follow AGENTS.md and the skills in .koda/skills. Fix only what the migrations or failing checks require. Keep behavior and unrelated code unchanged.
Never edit pnpm-lock.yaml by hand and never downgrade a Lumen package. Keep peerDependencies ranges unless the new version falls outside them.`,
  )
  .tools(allTools())
  .limits({ maxTurns: 40, timeoutMinutes: 30 });

const recorder = agent("recorder")
  .prompt("You write the terminal result of the run. Do not edit files.")
  .tools("read")
  .limits({ maxTurns: 4, timeoutMinutes: 5 });

// One upgrade PR at a time: `createBranch` adds a unique suffix, so without this each run opens another PR.
const openPrExitCode = variable("openPrExitCode", z.number());
const openPr = variable("openPr", z.string(), {
  description:
    "The open upgrade PR as JSON, with its url and headRefName. Empty when none is open.",
});

// Exit 0: no open upgrade PR. Exit 1: the bot's PR is open (stdout is its JSON), so the new PR replaces it.
// Exit 2: `gh` failed. Exit 3: a person opened it or committed to it, so it gets a comment and is left alone.
const checkOpenPrTask = task("check-open-pr")
  .runs(
    [
      `n=$(gh pr list --state open --limit 1000 --json number,headRefName --jq '[.[] | select(.headRefName | startswith("${branchPrefix}"))][0].number // empty') || exit 2`,
      '[ -z "$n" ] && exit 0',
      'gh pr view "$n" --json url,headRefName || exit 2',
      `bot=$(gh pr view "$n" --json author --jq '.author.is_bot') || exit 2`,
      `authors=$(gh pr view "$n" --json commits --jq '[.commits[].authors[].login] | unique | length') || exit 2`,
      '[ "$bot" = true ] && [ "$authors" -le 1 ] && exit 1',
      'gh pr comment "$n" --body "A newer Lumen release is out. People have committed to this branch, so the automated upgrade left it unchanged: the next release after this PR merges picks up the rest." || exit 2',
      "exit 3",
    ].join("\n"),
  )
  .continueOnError()
  .writes({ exit_code: openPrExitCode, stdout: openPr });

// Replacing the bot's PR instead of updating it keeps every run a full upgrade from develop:
// code merged on develop since then gets every migration in range.
const closeOldPrTask = task("close-old-pr")
  .uses(upgrader)
  .message(
    'Close the previous upgrade PR in openPr with `gh pr close <url> --delete-branch --comment "Superseded by <prUrl>."`.',
  )
  .with({ openPr, prUrl });

const createBranchTask = task("create-branch")
  .uses(upgrader)
  .createBranch({ name: branchPrefix });

const installTask = task("install").runs("pnpm install --frozen-lockfile");

// Sets each exact Lumen pin to the latest published version, then updates the lockfile.
// Caret ranges (peerDependencies) are left alone, and so is a pin newer than `latest` (dist-tag rollback, prerelease).
const bumpTask = task("bump").runs(
  [
    "set -e",
    `files=$(${lumenManifests})`,
    `for pkg in $(grep -hoE '"@ledgerhq/lumen-[a-z-]+"' $files | tr -d '"' | sort -u); do`,
    '  version=$(npm view "$pkg" version)',
    "  for f in $files; do",
    '    current=$(sed -nE "s|.*\\"$pkg\\": \\"([0-9][^\\"]*)\\".*|\\1|p" "$f" | head -1)',
    '    [ -n "$current" ] || continue',
    '    [ "$(printf \'%s\\n%s\\n\' "$current" "$version" | sort -V | tail -1)" = "$version" ] || continue',
    '    sed -i.bak -E "s|(\\"$pkg\\": \\")[0-9][^\\"]*\\"|\\1$version\\"|" "$f" && rm "$f.bak"',
    "  done",
    "done",
    "pnpm install --no-frozen-lockfile",
  ].join("\n"),
);

// Always `@latest`: the index only knows the releases published before the CLI version.
const migrationsCli = "npx --yes @ledgerhq/lumen-migrations@latest";

const migrateTask = task("migrate")
  .uses(upgrader)
  .message(
    `Apply the Lumen migrations for the upgrade range with the migrations CLI.
1. Get the previous version of each bumped @ledgerhq/lumen-* package from the package.json files that pin it on develop (\`git show origin/develop:<path>\`). The new version is in the working tree. When packages pin different previous versions, use the lowest.
2. For each of them, run \`${migrationsCli} list --package <name> --from <previous> --to <new> --json\`.
3. For each migration listed, run \`${migrationsCli} show <id>\` and follow it (Before → after, Decide).
4. For each package, run \`${migrationsCli} check --package <name> --from <previous> --to <new>\` from the repo root, so every package using Lumen is scanned. Exit code 1 means \`expect: none\` patterns still have hits: fix them and run it again. Hits listed as review are for a human: do not edit them.
5. List what you cannot decide for a human.`,
  );

const commitTask = task("commit")
  .uses(upgrader)
  .commit({ message: "⬆️ (repo): Upgrade Lumen to latest" });

const changesetTask = task("changeset")
  .uses(upgrader)
  .message(
    `Add a changeset for every published package (not "private": true) whose package.json or source files changed against origin/develop (git diff origin/develop --stat), following .koda/skills/changeset/SKILL.md: one package per changeset, patch unless a migration changed its public API. Do not commit.`,
  );

const commitChangesetTask = task("commit-changeset")
  .uses(upgrader)
  .commit({ message: "📝 (repo): Add the Lumen upgrade changesets" });

const pushTask = task("push").uses(upgrader).push();

const createPrTask = task("create-pr")
  .uses(upgrader)
  .createPr({
    title: "⬆️ (repo) [NO-ISSUE]: Upgrade Lumen to latest",
    body: `### 📝 Description

Automated Lumen upgrade to the latest versions, run by Koda from \`.koda/plans/lumen-upgrade.ts\`: bumps the pinned \`@ledgerhq/lumen-*\` versions and applies the Lumen migrations in range. Checked with \`${verifyCommand}\`.

Review before merging.

### ❓ Context

- **JIRA or GitHub link**: DLS-1166, [ADR 027: Automated Lumen upgrades in consumer repos](https://ledgerhq.atlassian.net/wiki/spaces/DLS/pages/7689666642)
- **Feature**: Lumen upgrade

### ✅ Checklist

- [x] **Covered by automatic tests**: lint and typecheck of the affected packages
- [x] **Changeset is provided**
- [ ] **Documentation is up-to-date**
- [ ] **Copilot comments are handled**
- [ ] **Impact of the changes:**
  - Lumen-based UIs: devtools, mock server UI, sample`,
  })
  .writes({ url: prUrl });

const recordPrCreatedTask = task("record-pr-created")
  .uses(recorder)
  .message(
    "Write the terminal result as pr-created, with a one-sentence summary and the pull request URL as prUrl.",
  )
  .with({ prUrl, verify })
  .writes(result);

const recordHumanCommitsTask = task("record-human-commits")
  .uses(recorder)
  .message(
    "Write the terminal result as skipped: a person opened or committed to the open upgrade PR in openPr, so it was left unchanged.",
  )
  .with({ openPr })
  .writes(result);

const recordLookupFailedTask = task("record-lookup-failed")
  .uses(recorder)
  .message(
    "Write the terminal result as failed: looking up the open upgrade PR with gh failed.",
  )
  .with({ openPr })
  .writes(result);

// Nothing to commit when Lumen was already at the latest version.
const changesExitCode = variable("changesExitCode", z.number());
const checkChangesTask = task("check-changes")
  .runs('test -n "$(git status --porcelain)"')
  .continueOnError()
  .writes({ exit_code: changesExitCode });

const recordUpToDateTask = task("record-up-to-date")
  .uses(recorder)
  .message(
    "Write the terminal result as skipped: the upgrade changed nothing because Lumen is already up to date.",
  )
  .writes(result);

const recordFailureTask = task("record-failure")
  .uses(recorder)
  .message(
    "Write the terminal result as failed. Give the failing check from the verify output as the reason.",
  )
  .with({ verify })
  .writes(result);

// What the Lumen workflow sends. The plan bumps to latest and doesn't read it yet.
const planInput = z.object({
  targetVersions: z.record(z.string(), z.string()),
  pr: z.object({ title: z.string(), labels: z.array(z.string()) }),
  changeset: z.boolean(),
  upstreamPackages: z.array(
    z.object({ package: z.string(), repo: z.string() }),
  ),
});

const upgrade = (b) =>
  b
    .do(createBranchTask)
    .do(installTask)
    .do(bumpTask)
    .do(checkChangesTask)
    .if(
      changesExitCode.eq(0),
      (c) =>
        c
          .do(migrateTask)
          .retryShell("verify", {
            max: 3,
            command: verifyCommand,
            fixer: (shellOutput) =>
              task("fix")
                .uses(upgrader)
                .message("Checks failed after the Lumen upgrade. Fix them.")
                .with({
                  stdout: shellOutput.field("stdout"),
                  stderr: shellOutput.field("stderr"),
                }),
          })
          .if(
            verify.field("exit_code").eq(0),
            (d) =>
              d
                .do(commitTask)
                .do(changesetTask)
                .do(commitChangesetTask)
                .do(pushTask)
                .do(createPrTask)
                .do(closeOldPrTask, { when: openPrExitCode.eq(1) })
                .do(recordPrCreatedTask),
            (d) => d.do(recordFailureTask),
          ),
      (c) => c.do(recordUpToDateTask),
    );

export default plan("lumen-upgrade")
  .input(planInput.partial())
  .do(checkOpenPrTask)
  .if(openPrExitCode.eq(3), (b) => b.do(recordHumanCommitsTask))
  .elseif(openPrExitCode.eq(2), (b) => b.do(recordLookupFailedTask))
  .else(upgrade);
