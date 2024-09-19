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

#### Branch naming

Depending on the purpose every git branch should be prefixed.

- `feat/` Add a new feature to the application or library
- `bugfix/` Fixing an existing bug
- `support/` for any other changes (tests, improvements, CI…)
  _For Ledger Employees:_
- `chore/` Cleaning purpose
- `doc/` Add or modify documentation
- `refacto/` Modify the code organisation

Then add to the prefix no-issue
_For Ledger Employees:_ Add the Jira ticket number `DSDK-<number>`

And finally add a small description.

**Example:** doc/no-issue-update-readme

#### Changelogs

We use [**changesets**](https://github.com/changesets/changesets) to handle the versioning of our libraries and apps. A detailed guide is available on the [**wiki**](https://github.com/LedgerHQ/device-sdk-ts/wiki/Changesets).

#### Commit message

We use the standard [**Conventional Commits**](https://www.conventionalcommits.org/) specification and enforce it using [**commitlint**](https://commitlint.js.org/).

The format is similar to gitmoji:

<emoji> (<scope>): <description>

- scope is the module/package that is impacted by the update.
- `<description>` should start with an uppercase.

You should use the `pnpm commit` prompt to ensure that your commit messages are valid, as well as the `pnpm commitlint --from <target branch>` command to check that every commit on your current branch are valid.

#### Rebase & Merge strategies

The rule of thumb is to **always favour rebasing** as long as your branch does not contain merge commits.

For instance:

- bugfix branches that are small and self-contained should always get rebased on top of `develop`.
- feature branches should always get rebased on top of `develop`.

### Pull Request Conventions

Follow the next step to fill the PR template

#### Title

The description format is similar to gitmoji:

<emoji> (<scope>) [NO-ISSUE]: <description>

1. scope is the module/package that is impacted by the update (should be the same than the commit ones).

2. _For Ledger Employees:_ `NO-ISSUE` to be replace by `DSDK-<number>` in case of tracking.

3. `<description>` should start with an uppercase.

#### Description

- Write a full description of what your pull request is about and why it was needed.
- Add some screenshots or videos if relevant.
- Do not forget to fill the checklist

### Workflow

- Github actions will trigger depending on which part of the codebase is impacted.
- Your PR must pass the required CI actions.
- Your PR must include a changelog (`pnpm changeset`), except for tools and maintenance operations.

### Developer Portal

Ledger provides the tools and resources you need to build on top of our platform. They are accessible in the [Ledger Developer Portal](https://developers.ledger.com/).
