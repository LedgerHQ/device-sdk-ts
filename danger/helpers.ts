// NOTE: we cannot import danger from another module,
// so we need to pass them as arguments, only types can be imported
import { type GitHubPRDSL, type DangerDSLType } from "danger";
import { execSync } from "child_process";
import { writeFileSync, appendFileSync } from "fs";

// ── Types ──────────────────────────────────────────────────────────

export type CheckResult = {
  passed: boolean;
  message?: string;
  icon?: string;
};

type RunChecksOptions = {
  fork: boolean;
  includeTitle: boolean;
};

// ── Utility helpers ────────────────────────────────────────────────

const BRANCH_PREFIX = [
  "feature",
  "feat",
  "bugfix",
  "bug",
  "hotfix",
  "fix",
  "support",
  "chore",
  "core",
  "doc",
  "refacto",
  "refactor",
];

export const checkIfBot = (user: GitHubPRDSL["user"]) => user.type === "Bot";

export const getAuthor = (danger: DangerDSLType) => {
  if (danger.github) {
    return danger.github.pr.user.login;
  }

  return execSync("git log -1 --pretty=format:'%an'").toString().trim();
};

export const isFork = (pr: GitHubPRDSL) => pr?.head?.repo?.fork ?? false;

// ── Internal factory helpers ───────────────────────────────────────

const Branch = (danger: DangerDSLType, isFork: boolean = false) => ({
  regex: isFork
    ? new RegExp(`^(${BRANCH_PREFIX.join("|")})\/.+`, "i")
    : new RegExp(
        `^(release|chore\/backmerge(-.+){0,}|(${BRANCH_PREFIX.join("|")})\/((dsdk|live)-[0-9]+|no-issue|NOISSUE|issue-[0-9]+)-.+)`,
        "i"
      ),

  getBranch: () => {
    if (danger.github) {
      return danger.github.pr.head.ref;
    }

    return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  },

  failMessage(currentBranch: string): string {
    return isFork
      ? `\
Please fix the PR branch name to match the convention, see [CONTRIBUTING.md](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/CONTRIBUTING.md).

**Wrong branch name**: \`${currentBranch}\`

ℹ️ Regex to match: \`${this.regex}\`

- Rules:
  - Must start with a type (${BRANCH_PREFIX.join(", ")})
  - Followed by a SLASH ("/")
  - Followed by a description

ℹ️ Example: \`feat/my-feature\`\
`
      : `\
Please fix the PR branch name to match the convention, see [CONTRIBUTING.md](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/CONTRIBUTING.md).

**Wrong branch name**: \`${currentBranch}\`

ℹ️ Regex to match: \`${this.regex}\`

- Rules:
  - Must start with a type (${BRANCH_PREFIX.join(", ")})
  - Followed by a SLASH ("/")
  - Followed by a JIRA issue number (DSDK-1234) (LIVE-1234) or "no-issue" or "issue-1234" if fixing a Github issue
  - Followed by a DASH ("-")
  - Followed by a description

ℹ️ Example: \`feat/dsdk-1234-my-feature\`\
`;
  },
});

const Commits = (danger: DangerDSLType, fork: boolean = false) => ({
  regex: /^.+\s\(([a-z]+\-?){1,}\)(\s\[(NO-ISSUE|([A-Z]+\-\d+))\])?: [A-Z].*/,

  failMessage(wrongCommits: string[]): string {
    return `\
One or more commit message does not match the convention, see [CONTRIBUTING.md](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/CONTRIBUTING.md).

**Wrong commit messages**:
${wrongCommits.map((commit) => `• \`${commit}\``).join("\n")}

ℹ️ Regex to match: \`${this.regex}\`

- Rules:
  - Must start with a word (a gitmoji compliant emoji)
  - Followed by a SPACE
  - Followed by a scope in parentheses and in LOWERCASE
  - _Optional_
    - Followed by a SPACE
    - Followed by a JIRA issue number in brackets [DSDK-1234] or [NO-ISSUE]
  - Followed by a colon (":") and a SPACE
  - Followed by a <ins>C</ins>apitalized message

Example: \`💚 (scope): My feature\`\

Special case for commit messages coming from a pull request merge:
 - \`💚 (scope) [DSDK-1234]: My feature\`\
 - \`💚 (scope) [NO-ISSUE]: My title\`\
`;
  },

  getCommits: () => {
    if (danger.github) {
      return danger.github.commits.map(({ commit }) => commit.message);
    }

    const currentBranch = Branch(danger, fork).getBranch();
    return execSync(
      `git log origin/develop..${currentBranch} --pretty=format:%s`
    )
      .toString()
      .split("\n");
  },
});

const Title = (_danger: DangerDSLType, fork: boolean = false) => ({
  regex: fork
    ? /^.+ \(([a-z]+\-?){1,}\): [A-Z].*/
    : /^.+ \(([a-z]+\-?){1,}\) \[(DSDK-[0-9]+|LIVE-[0-9]+|NO-ISSUE|ISSUE-[0-9]+)\]: [A-Z].*/,

  failMessage(wrongTitle: string): string {
    if (fork) {
      return `\
Please fix the PR title to match the convention, see [CONTRIBUTING.md](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/CONTRIBUTING.md).

**Wrong PR title**: \`${wrongTitle}\`

ℹ️ Regex to match: \`${this.regex}\`
- Rules:
  - Must start with a word (usually an emoji)
  - Followed by a SPACE
  - Followed by a scope in parentheses and in LOWERCASE
  - _Optional_
    - _Followed by a SPACE_
    - _Followed by ISSUE-<number> to reference a Github issue_
  - Followed by a colon (":") and a SPACE
  - Followed by a <ins>C</ins>apitalized message

ℹ️ Example: \`✨ (scope): My feature\`\
`;
    } else {
      return `\
Please fix the PR title to match the convention, see [CONTRIBUTING.md](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/CONTRIBUTING.md).

**Wrong PR title**: \`${wrongTitle}\`

ℹ️ Regex to match: \`${this.regex}\`

- Rules:
  - Must start with a word (usually an emoji)
  - Followed by a SPACE
  - Followed by a scope in parentheses and in LOWERCASE
  - Followed by a SPACE
  - Followed by a JIRA issue number or NO-ISSUE or ISSUE-<number> in [brackets] (uppercase)
  - Followed by a colon (":") and a SPACE
  - Followed by a <ins>C</ins>apitalized message

ℹ️ Example: \`✨ (scope) [DSDK-1234]: My feature\`\
`;
    }
  },
});

const SignedCommits = (danger: DangerDSLType, fork: boolean = false) => ({
  failMessage(unsignedCommits: string[]): string {
    return `\
One or more commits are not signed. All commits must be signed to merge into protected branches (\`develop\` and \`main\`).

**Unsigned commits**:
${unsignedCommits.map((commit) => `• \`${commit}\``).join("\n")}

To sign your commits:
1. Set up commit signing: https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits
2. Configure Git to sign by default: \`git config --global commit.gpgsign true\`
3. Re-sign your commits:
   \`\`\`bash
   git rebase -i origin/develop --exec "git commit --amend --no-edit -S"
   git push --force-with-lease
   \`\`\`

See [CONTRIBUTING.md](https://github.com/LedgerHQ/device-sdk-ts/blob/develop/CONTRIBUTING.md#signed-commits) for more details.\
`;
  },

  getUnsignedCommits: (): string[] => {
    if (danger.github) {
      // In CI: use GitHub API to check verification status
      return danger.github.commits
        .filter(({ commit }) => !commit.verification?.verified)
        .map(({ commit }) => commit.message.split("\n")[0]);
    }

    // Locally: use git log to check signature status
    // %G? returns: G (good), N (no signature), B (bad), etc.
    // %s returns the commit subject
    const currentBranch = Branch(danger, fork).getBranch();
    const output = execSync(
      `git log origin/develop..${currentBranch} --pretty=format:"%G?|%s"`
    )
      .toString()
      .trim();

    if (!output) return [];

    return output
      .split("\n")
      .filter((line) => {
        const [status] = line.split("|");
        // G = good signature, U = good signature with unknown validity (acceptable locally)
        return status !== "G" && status !== "U";
      })
      .map((line) => line.split("|").slice(1).join("|"));
  },
});

// ── Check functions (pure, return data) ────────────────────────────

const checkBranches = (
  danger: DangerDSLType,
  fork: boolean = false
): CheckResult => {
  const config = Branch(danger, fork);
  const currentBranch = config.getBranch();
  if (!config.regex.test(currentBranch)) {
    return { passed: false, message: config.failMessage(currentBranch) };
  }

  return { passed: true };
};

const checkCommits = (
  danger: DangerDSLType,
  fork: boolean = false
): CheckResult => {
  const config = Commits(danger, fork);
  const branchCommits = config.getCommits();

  const wrongCommits = branchCommits.filter(
    (commit) => !config.regex.test(commit)
  );

  if (wrongCommits.length > 0) {
    return { passed: false, message: config.failMessage(wrongCommits) };
  }

  return { passed: true };
};

const checkTitle = (
  danger: DangerDSLType,
  fork: boolean = false
): CheckResult => {
  const config = Title(danger, fork);
  if (!config.regex.test(danger.github.pr.title)) {
    return {
      passed: false,
      message: config.failMessage(danger.github.pr.title),
    };
  }

  return { passed: true };
};

const checkChangesets = (danger: DangerDSLType): CheckResult => {
  const changesetFiles = danger.git.fileMatch("**/.changeset/*.md");
  if (changesetFiles.edited === false) {
    return {
      passed: true,
      message:
        "No changeset file found. Please make sure this is intended or add a changeset file.",
      icon: "⚠️",
    };
  }

  return { passed: true };
};

const checkSignedCommits = (
  danger: DangerDSLType,
  fork: boolean = false
): CheckResult => {
  const config = SignedCommits(danger, fork);
  const unsignedCommits = config.getUnsignedCommits();

  if (unsignedCommits.length > 0) {
    return { passed: false, message: config.failMessage(unsignedCommits) };
  }

  return { passed: true };
};

// ── Orchestration functions ────────────────────────────────────────

export function runChecks(
  danger: DangerDSLType,
  opts: RunChecksOptions
): CheckResult[] {
  const checkResults: CheckResult[] = [
    checkBranches(danger, opts.fork),
    checkCommits(danger, opts.fork),
    ...(opts.includeTitle ? [checkTitle(danger, opts.fork)] : []),
    checkSignedCommits(danger, opts.fork),
    checkChangesets(danger),
  ];

  const hasFailures = checkResults.some((o) => !o.passed);
  if (!hasFailures) {
    checkResults.push({
      passed: true,
      message: "Danger: All checks passed successfully! 🎉",
    });
  }

  return checkResults;
}

function generateReport(checkResults: CheckResult[]): string {
  const failures = checkResults.filter((o) => !o.passed && o.message);
  const messages = checkResults.filter((o) => o.passed && o.message);

  const sections: string[] = [];

  if (failures.length > 0) {
    const rows = failures
      .map((o) => `<tr><td>🚫</td><td>\n\n${o.message}\n\n</td></tr>`)
      .join("\n");
    sections.push(`### Failures\n\n<table>\n${rows}\n</table>`);
  }

  if (messages.length > 0) {
    const rows = messages
      .map(
        (o) =>
          `<tr><td>${o.icon || "✅"}</td><td>\n\n${o.message}\n\n</td></tr>`
      )
      .join("\n");
    sections.push(`### Messages\n\n<table>\n${rows}\n</table>`);
  }

  if (sections.length === 0) return "";

  return `## Danger Check Results\n\n${sections.join("\n\n")}\n`;
}

type MarkdownFn = (message: string) => void;

export function outputResults(
  checkResults: CheckResult[],
  markdown: MarkdownFn,
) {
  const report = generateReport(checkResults);

  // Write report to $GITHUB_STEP_SUMMARY or /tmp/danger-report.md (best-effort)
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  try {
    if (summaryFile) {
      appendFileSync(summaryFile, report);
    } else {
      const path = "/tmp/danger-report.md";
      writeFileSync(path, report);
      console.log(`\nReport written to ${path}`);
    }
  } catch (e) {
    console.warn("Failed to write danger report to file:", e);
  }

  // Post as PR comment / local output (best-effort)
  try {
    markdown(report);
  } catch (e) {
    console.error("Failed to post danger comment:", e);
  }

  // Exit with failure if any checks failed
  if (checkResults.some((res) => !res.passed)) {
    process.exit(1);
  }
}
