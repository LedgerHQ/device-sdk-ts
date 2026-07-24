# AI Agent Guidelines

AI agents contributing to this repository must follow project conventions.

## Description

The Device Management Kit (DMK) is a TypeScript library that provides easy communication with Ledger devices.

## Documentation

- [README.md](README.md)
- [CONTRIBUTING.md](CONTRIBUTING.md) - Full contribution guidelines (branch naming, commits, PRs, changesets)

## Tools

- **proto** is used as the toolchain manager to install the right version of every tool.
- **pnpm** is used as the package manager to install all the dependencies.
- Use `gh` CLI (if available) for GitHub operations (create/update PRs, view workflows, comments, etc.)

## Cursor Skills

Skills are activated automatically when the user's request matches a trigger phrase.

| Skill                                               | Trigger                   | Description                                                                    |
| --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| [Release Packages](.cursor/skills/release/SKILL.md) | `release`, `/release`     | Orchestrates the full release flow using scripts in `.cursor/scripts/release/` |
| [Backmerge](.cursor/skills/backmerge/SKILL.md)      | `backmerge`, `/backmerge` | Backmerge release into develop after PR merges                                 |

## Cursor Commands

Commands are invoked explicitly by the user (via the command palette or `/` prefix).

| Command                                                                  | Description                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [commit](.cursor/commands/commit.md)                                     | Create a commit following gitmoji conventions                      |
| [changeset](.cursor/commands/changeset.md)                               | Create a changeset for a package                                   |
| [create-pr](.cursor/commands/create-pr.md)                               | Create a GitHub PR with proper title, changeset, and CI validation |
| [trigger-snapshot-release](.cursor/commands/trigger-snapshot-release.md) | Trigger the snapshot release CI workflow                           |

## Cursor Rules

Rules provide context to agents when relevant (not always applied).

| Rule                                         | Description                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [commit.mdc](.cursor/rules/commit.mdc)       | Gitmoji commit message format and signing requirements                                                                           |
| [changeset.mdc](.cursor/rules/changeset.mdc) | Changeset creation guidelines (one package per changeset, bump types)                                                            |
| [lumen.mdc](.cursor/rules/lumen.mdc)         | Lumen design system usage (@ledgerhq/lumen-ui-react + design-core, Tailwind v4) and how it coexists with react-ui in apps/sample |

## Cursor Hooks

Hooks run automatically on agent events. Configured in [.cursor/hooks.json](.cursor/hooks.json).

| Hook                                                               | Event           | Description                                         |
| ------------------------------------------------------------------ | --------------- | --------------------------------------------------- |
| [format.cjs](.cursor/scripts/hooks/format.cjs)                     | `afterFileEdit` | Auto-formats edited files with Prettier             |
| [post-task-checks.cjs](.cursor/scripts/hooks/post-task-checks.cjs) | `stop`          | Runs tests, lint, and typecheck on changed packages |

## Sandbox permissions

The following commands require `required_permissions: ["all"]` because the default sandbox blocks post-install scripts, native module builds, or network access they need:

- `pnpm install` / `pnpm i`
- Any command that calls the GitHub API via `gh` (e.g. `gh auth status`, release scripts that fetch PR metadata)
