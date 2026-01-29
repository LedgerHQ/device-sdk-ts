# Create PR

Create a GitHub pull request with proper title, changeset, and all required elements.

## Prompt Variables

All variables are optional. The AI will auto-derive values from context and only prompt when necessary.

$TICKET

> (Optional) JIRA ticket or NO-ISSUE. Auto-extracted from branch name if present.

$EMOJI

> (Optional) Gitmoji emoji. Auto-selected based on diff contents.

$SCOPE

> (Optional) Package scope in lowercase. Auto-detected from changed files.

$DESCRIPTION

> (Optional) Short description. Auto-generated from diff analysis.

$DRAFT

> (Optional) Whether to create as draft PR. Defaults to true.

## Instructions

**Before starting**: Read [CONTRIBUTING.md](../../CONTRIBUTING.md) and [danger/helpers.ts](../../danger/helpers.ts) to understand the current validation rules for branches, commits, and PR titles.

### Step 1: Pre-flight checks

1. Check for uncommitted changes with `git status --porcelain`. If any exist, ask user whether to commit, stash, or abort.

2. Check if a PR already exists for this branch:

   ```bash
   gh pr view --json url,title,state 2>/dev/null
   ```

   If it exists, ask user whether to update it or abort.

3. Detect if this is a fork (forks have relaxed validation rules per CONTRIBUTING.md):
   ```bash
   gh repo view --json isFork -q .isFork
   ```

### Step 2: Check current branch state

1. Get current branch with `git branch --show-current`
2. If on `develop` or `main`, ask user for a new branch name following the conventions in [CONTRIBUTING.md](../../CONTRIBUTING.md), then create it with `git checkout -b <branch-name>`
3. Validate the branch name against the regex in [danger/helpers.ts](../../danger/helpers.ts). Do not skip this as a wrong branch name will force the user to close the PR and reopen a new one.
4. Extract ticket from branch name (refer to danger/helpers.ts for the valid ticket patterns)

### Step 3: Analyze changes

1. Run `git fetch origin develop && git diff origin/develop` to understand the changes (use remote to avoid stale local branch)
2. Run `git status` to see modified files
3. Validate existing commit messages against the regex in [danger/helpers.ts](../../danger/helpers.ts):
   ```bash
   git log origin/develop..HEAD --pretty=format:%s
   ```
   If any commits don't match, warn the user they may need to amend commits before the PR can pass CI.
4. Auto-derive:
   - **Scope**: from the most impacted package(s) under `packages/`
   - **Emoji**: run `pnpm gitmoji --list` and select the most appropriate one based on diff contents
   - **Description**: summarize the changes in a few words, starting with uppercase

### Step 4: Ask for missing info

1. If ticket was not extracted from branch name (and not a fork), ask the user for it
2. Present the auto-derived values (emoji, scope, description) for confirmation
3. Allow user to override any values if needed
4. Ask if the PR should be created as draft (default: yes)

### Step 5: Verify changeset

1. Check if a changeset file exists in `.changeset/`
2. If not, and the changes affect **published packages** (not apps or internal tooling), create one following [.cursor/rules/changeset.mdc](../rules/changeset.mdc)

> Note: Changesets are only required for published packages, not for apps or internal tooling (see CONTRIBUTING.md).

### Step 6: Stage and commit if needed

If there are changes after creating the changeset:

1. Stage the changes
2. Create a commit following the format in [CONTRIBUTING.md](../../CONTRIBUTING.md)
3. Validate the commit message against the regex in [danger/helpers.ts](../../danger/helpers.ts)

### Step 7: Push branch

```bash
git push -u origin HEAD
```

### Step 8: Create or update PR

**Read [CONTRIBUTING.md](../../CONTRIBUTING.md) for the exact PR title format** (different for forks vs non-forks).

For the PR body, use the structure from [.github/pull_request_template.md](../../.github/pull_request_template.md) and fill in:

- Description based on diff analysis
- Ticket link
- Checklist: check "Changeset is provided" if one was created, otherwise add a note explaining why no changeset is needed (e.g., "No changeset needed - changes only affect apps/internal tooling")

Use `gh pr create` (or `gh pr edit` if updating):

```bash
# Add --draft flag only if user chose draft mode
gh pr create [--draft] --title "<TITLE>" --body "<BODY>"
```

When updating an existing PR, ask the user if they want to update the body as well:

```bash
gh pr edit --title "<TITLE>" --body "<BODY>"
```

### Step 9: Output PR URL

After creating/updating the PR, output the URL in two formats (do NOT auto-open):

```
PR created successfully!

URL: <PR_URL>

[<TITLE>](<PR_URL>)
```

## Reference Files

- [CONTRIBUTING.md](../../CONTRIBUTING.md) - All conventions (branch naming, PR title format, commit format)
- [danger/helpers.ts](../../danger/helpers.ts) - CI validation regexes (source of truth)
- [.github/pull_request_template.md](../../.github/pull_request_template.md) - PR body template structure
- [.cursor/rules/changeset.mdc](../rules/changeset.mdc) - Changeset creation guidelines
