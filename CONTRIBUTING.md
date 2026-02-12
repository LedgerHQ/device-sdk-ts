# Contributing

:+1::tada: First off, thanks for taking the time to contribute! :tada::+1:

This file will guide you through the local setup and contains the guidelines you will need
to follow to get your code merged.

## Disclaimer

While you explore these projects, here are some key points to keep in mind:

- Follow the git workflow, prefix your branches and do not create unnecessary merge commits.
- Be mindful when creating Pull Requests, clearly specify the purpose of your changes and include tests where applicable.
- Device Management Kit is mostly accepting bugfix contributions. Feature contributions are subject to review; they may be declined if they don't align with our roadmap or our long-term objectives.

## Guidelines

### Important Steps

**Before submitting a pull request, please make sure the following is done:**

1. Fork the repository and create your branch from `develop` (check the git conventions for the naming of the branch).
2. Follow the main installation steps. (https://github.com/LedgerHQ/device-sdk-ts#getting+started)
3. Follow additional installation steps depending on which package you want to contribute to.
4. Make your changes.
5. If you’ve fixed a bug or added code that should be tested, add tests!
6. If your changes affect published packages, add an entry to the changelog (`pnpm changeset`).
7. Make sure that the code passes linter and type checks (`pnpm lint:fix` and `pnpm typecheck`).
8. Make sure that the code passes the prettier checks.
9. Make sure the code passes unit and end to end tests (`pnpm test`).
10. Cleanup your branch - unless it contains merge commits (perform atomic commits, squash tiny commits…).
11. **Sign your commits** (see [Signed Commits](#signed-commits) below).

### Git Conventions

We use the following git conventions for the `Device Management Kit` monorepo.

**Branch names and commit messages are validated by [Danger CI](danger/helpers.ts) on pull requests.**

#### Branch naming

Branch names **MUST** follow this format and are validated by CI.

**Format:** `<type>/<ticket>-<description>`

**Type** (required): Must be one of the prefixes defined in [`danger/helpers.ts`](danger/helpers.ts) (`BRANCH_PREFIX` constant). Common types include:

- `feat/` / `feature/` — Add a new feature to the application or library
- `bugfix/` / `bug/` / `fix/` / `hotfix/` — Fixing an existing bug
- `support/` — For any other changes (tests, improvements, CI…)
- `chore/` / `core/` — For maintenance work on the repo _(Ledger employees only)_
- `doc/` — Add or modify documentation _(Ledger employees only)_
- `refacto/` / `refactor/` — Modify the code organisation _(Ledger employees only)_

> **Note:** The complete list of accepted types is enforced by CI via the regex in `danger/helpers.ts`. Refer to that file for the authoritative list.

**Ticket** (required for branches on the main repository, not forks):

- `DSDK-<number>` or `LIVE-<number>` — Jira ticket reference
- `no-issue` — When no ticket exists (**default for automated/AI contributions**)
- `issue-<number>` — GitHub issue reference

**Description**: Short kebab-case description of the change.

**Examples:**

| Context                     | Example                            |
| --------------------------- | ---------------------------------- |
| With Jira ticket            | `feature/dsdk-350-add-sparkles`    |
| No ticket (use when unsure) | `fix/no-issue-typo-in-readme`      |
| GitHub issue reference      | `bugfix/issue-42-connection-error` |

**Note for external contributors (forks):** The ticket requirement is relaxed by CI. A simple `feat/my-feature` format is valid.

#### Changelogs

We use [**changesets**](https://github.com/changesets/changesets) to handle the versioning of our libraries and apps.

Run `pnpm changeset` to create a changeset interactively. You will be prompted to:

- Select the affected package(s)
- Choose the version bump type:
  - **patch** - Bug fixes or minor, non-breaking modifications
  - **minor** - New features, additions, or improvements
  - **major** - Breaking changes (use only when explicitly required)
- Write a summary describing the change

**Guidelines:**

- Prefer a single changeset per package per PR
- Each changeset should be concise and focused on a specific purpose
- Changesets are required for published packages, not for apps or internal tooling

#### Commit message

We use [**gitmoji**](https://gitmoji.dev/) for commit messages. The format is:

`<emoji> (<scope>): <Description>`

or with an optional ticket reference (for merge commits):

`<emoji> (<scope>) [<ticket>]: <Description>`

- `<emoji>` - Use `pnpm gitmoji --list` to see available emojis
- ` ` - Space
- `(<scope>)` - The module/package impacted (lowercase, in parentheses)
- `[<ticket>]` - Optional: `[DSDK-1234]`, `[NO-ISSUE]`, etc. (typically used for merge commits)
- `:` - Colon
- ` ` - Space
- `<Description>` - Should start with an uppercase letter

Use `pnpm commit` to create commits interactively.

#### Signed Commits

**All commits must be signed** to be merged into protected branches (`develop` and `main`).

This is enforced by GitHub branch rulesets. Even if your PR targets `develop`, your commits will eventually be merged into `main` during a release, so signing is required from the start.

**To set up commit signing:**

1. Follow GitHub's guide: [Signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits)
2. Configure Git to sign commits by default:
   ```bash
   git config --global commit.gpgsign true
   ```

**If you already have unsigned commits**, you can re-sign them:

```bash
# Re-sign the last N commits (replace 3 with your number of commits)
git rebase -i HEAD~3 --exec "git commit --amend --no-edit -S"
git push --force-with-lease
```

Your commits should show as **"Verified"** on GitHub after signing.

#### Rebase & Merge strategies

The rule of thumb is to **always favour rebasing** as long as your branch does not contain merge commits.

For instance:

- bugfix branches that are small and self-contained should always get rebased on top of `develop`.
- feature branches should always get rebased on top of `develop`.

### Pull Request Conventions

Follow the [PR template](.github/pull_request_template.md) when creating your pull request.

**PR titles are validated by [Danger CI](danger/helpers.ts) on pull requests.**

#### Title

The description format is similar to gitmoji:

<emoji> (<scope>) [NO-ISSUE]: <description>

1. scope is the module/package that is impacted by the update (should be the same than the commit ones).

2. _For Ledger Employees:_ `NO-ISSUE` to be replace by `DSDK-<number>` or `ISSUE-<number>` in case of tracking

3. `<description>` should start with an uppercase.

#### Description

- Write a full description of what your pull request is about and why it was needed.
- Add some screenshots or videos if relevant.
- Do not forget to fill the checklist

### Workflow

- Github actions will trigger depending on which part of the codebase is impacted.
- Your PR must pass the required CI actions.
- Your PR must include a changelog (`pnpm changeset`), except for tools and maintenance operations.

_For external contributors:_ a member of the Ledger will be required to validate the execution of the CI for external contributions

### Developer Portal

Ledger provides the tools and resources you need to build on top of our platform. They are accessible in the [Ledger Developer Portal](https://developers.ledger.com/).
