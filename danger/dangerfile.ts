import { danger, fail } from "danger";
import { execSync } from "child_process";
import { exit } from "process";

console.log("PR Actor:", danger.github?.pr.user ?? "local run");

const branchPrefix = [
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

const currentBranch = execSync("git rev-parse --abbrev-ref HEAD")
  .toString()
  .trim();
const branchCommits = execSync(
  `git log origin/develop..HEAD --pretty=format:%s`
)
  .toString()
  .split("\n");

console.log("Current branch:", currentBranch);
console.log("Branch commits:", branchCommits);

if (danger.github?.pr.user.type === "Bot") exit(0);

const branchRegex = new RegExp(
  `^(${branchPrefix.join("|")})\/((dsdk)-[0-9]+|no-issue)\-.+`,
  "i"
);
if (!branchRegex.test(currentBranch)) {
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

const titleRegex =
  /^.+ \(([a-z]+\-?){1,}\) \[(DSDK-[0-9]+|NO-ISSUE)\]: [A-Z].*/;

if (danger.github?.pr && !titleRegex.test(danger.github?.pr.title)) {
  fail(`\
Please fix the PR title to match the convention, see [this documentation](https://ledgerhq.atlassian.net/wiki/spaces/WXP/pages/4527358147/DSDK+TS+Git+-+Github+conventions).

**Wrong PR title**: \`${danger.github?.pr.title}\`

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

const commitRegex = /^.+\(([a-z]+\-?){1,}\): [A-Z].*/;
const wrongCommits = branchCommits.filter(
  (commit) => !commitRegex.test(commit)
);
for (let commit of branchCommits) {
  if (!commitRegex.test(commit)) {
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
    break;
  }
}
