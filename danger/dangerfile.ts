import { danger, fail } from "danger";

const branchRegex =
  /^(feature|bugfix|support|chore|doc|refacto)\/((DSDK|dsdk)-[0-9]+|NO-ISSUE|no-issue)\-.*/;
if (!branchRegex.test(danger.github.pr.head.ref)) {
  fail(
    "Please fix the PR branch name to match the convention, see [this documentation](https://ledgerhq.atlassian.net/wiki/spaces/WXP/pages/4527358147/DSDK+TS+Git+-+Github+conventions)"
  );
}

const titleRegex = /^.+ \([a-z]+\) \[(DSDK-[0-9]+|NO-ISSUE)\]: [A-Z].*/;
if (!titleRegex.test(danger.github.pr.title)) {
  fail(
    "Please fix the PR title to match the convention, see [this documentation](https://ledgerhq.atlassian.net/wiki/spaces/WXP/pages/4527358147/DSDK+TS+Git+-+Github+conventions)"
  );
}

const commitRegex = /^.+ \([a-z]+\): [A-Z].*/;
for (let { commit } of danger.github.commits) {
  if (!commitRegex.test(commit.message)) {
    fail(
      "One or more commit message does not match the convention, see [this documentation](https://ledgerhq.atlassian.net/wiki/spaces/WXP/pages/4527358147/DSDK+TS+Git+-+Github+conventions)."
    );
    break;
  }
}
