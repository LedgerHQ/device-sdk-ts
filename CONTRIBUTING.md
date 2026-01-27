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
6. Add an entry to the changelog (`pnpm changeset`).
7. Make sure that the code passes linter and type checks (`pnpm lint:fix` and `pnpm typecheck`).
8. Make sure that the code passes the prettier checks.
9. Make sure the code passes unit and end to end tests (`pnpm test`).
10. Cleanup your branch - unless it contains merge commits (perform atomic commits, squash tiny commits…).

### Git Conventions

We use the following git conventions for the `Device Management Kit` monorepo.

**Branch names and commit messages are validated by [Danger CI](danger/helpers.ts) on pull requests.**

#### Branch naming

Depending on the purpose every git branch should be prefixed.

- `feat/` / `feature/` Add a new feature to the application or library
- `bugfix/` / `bug/` / `fix/` Fixing an existing bug
- `support/` For any other changes (tests, improvements, CI…)
  _For Ledger Employees:_
- `chore/` / `core/` For maintenance work on the repo
- `doc/` Add or modify documentation
- `refacto/` / `refactor/` Modify the code organisation

_For Ledger Employees only:_ Add the Jira ticket number `DSDK-<number>` _(case insensitive)_ or `NO-ISSUE` if not applicable.

_If resolving a Github issue (optional and not to be combined with Jira ticket number):_ add `ISSUE-<number>`

Followed by a small description.

**Examples:**

| User type     | Ticket | Example                          |
| ------------- | ------ | -------------------------------- |
| `employee`    | yes    | feature/dsdk-350-add-sparkles    |
| `employee`    | no     | refacto/no-issue-remove-sparkles |
| `contributor` | yes    | feat/issue-37-add-new-transport  |
| `contributor` | no     | fix/missing-dependencies         |

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

- `<emoji>` - Use `pnpm gitmoji --list` to see available emojis
- ` ` - Space
- `(<scope>)` - The module/package impacted (lowercase, in parentheses)
- `:` - Colon
- ` ` - Space
- `<Description>` - Should start with an uppercase letter

Use `pnpm commit` to create commits interactively.

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
