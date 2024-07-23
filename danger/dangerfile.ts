import { execSync } from "child_process";
import { danger, fail, message } from "danger";
import { exit } from "process";

const isLocalRun = !danger.github;
console.log("PR Actor:", isLocalRun ? "Local run" : danger.github.pr.user);

let successful = true;

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

const currentBranch = isLocalRun
  ? execSync("git rev-parse --abbrev-ref HEAD").toString().trim()
  : danger.github.pr.head.ref;
console.log("Current branch:", currentBranch);

const branchCommits: string[] = isLocalRun
  ? execSync(`git log origin/develop..${currentBranch} --pretty=format:%s`)
      .toString()
      .split("\n")
  : danger.github.commits.map(({ commit }) => commit.message);
console.log("Branch commits:", branchCommits);

// Check if user is not a Bot
if (!isLocalRun && danger.github.pr.user.type === "Bot") {
  exit(0);
}

const branchRegex = new RegExp(
  `^(${BRANCH_PREFIX.join("|")})\/((dsdk)-[0-9]+|no-issue)\-.+`,
  "i"
);
if (!branchRegex.test(currentBranch)) {
  successful = false;
  fail(`\
Please fix the PR branch name to match the convention, see [this documentation](https://ledgerhq.atlassian.net/wiki/spaces/WXP/pages/4527358147/DSDK+TS+Git+-+Github+conventions).

**Wrong branch name**: \`${currentBranch}\`

ℹ️ Regex to match: \`${branchRegex}\`

- Rules:
  - Must start with a type (feature, bugfix, hotfix, support, chore, core, doc, refacto)
  - Followed by a SLASH ("/")
  - Followed by a JIRA issue number (DSDK-1234) or "no-issue"
  - Followed by a DASH ("-")
  - Followed by a description

ℹ️ Example: \`feat/dsdk-1234-my-feature\`\
`);
}

const commitRegex = /^.+\(([a-z]+\-?){1,}\): [A-Z].*/;
const wrongCommits = branchCommits.filter(
  (commit) => !commitRegex.test(commit)
);
if (wrongCommits.length > 0) {
  successful = false;
  fail(`\
One or more commit message does not match the convention, see [this documentation](https://ledgerhq.atlassian.net/wiki/spaces/WXP/pages/4527358147/DSDK+TS+Git+-+Github+conventions).

**Wrong commit messages**:
${wrongCommits.map((commit) => `• \`${commit}\``).join("\n")}

ℹ️ Regex to match: \`${commitRegex}\`

- Rules:
  - Must start with a word (usually an emoji)
  - Followed by a SPACE
  - Followed by a scope in parentheses and in LOWERCASE
  - Followed by a colon (":") and a SPACE
  - Followed by a <ins>C</ins>apitalized message

Example: \`💚 (scope): My feature\`\
`);
}

if (!isLocalRun) {
  const titleRegex =
    /^.+ \(([a-z]+\-?){1,}\) \[(DSDK-[0-9]+|NO-ISSUE)\]: [A-Z].*/;

  if (!titleRegex.test(danger.github.pr.title)) {
    successful = false;
    fail(`\
Please fix the PR title to match the convention, see [this documentation](https://ledgerhq.atlassian.net/wiki/spaces/WXP/pages/4527358147/DSDK+TS+Git+-+Github+conventions).

**Wrong PR title**: \`${danger.github.pr.title}\`

ℹ️ Regex to match: \`${titleRegex}\`
- Rules:
  - Must start with a word (usually an emoji)
  - Followed by a SPACE
  - Followed by a scope in parentheses and in LOWERCASE
  - Followed by a SPACE
  - Followed by a JIRA issue number in [brackets] (uppercase)
  - Followed by a colon (":") and a SPACE
  - Followed by a <ins>C</ins>apitalized message

Example: \`💚 (scope) [DSDK-1234]: My feature\`\
`);
  }
}

if (successful) {
  message("Danger: All checks passed successfully! 🎉", { icon: "✅" });
}
