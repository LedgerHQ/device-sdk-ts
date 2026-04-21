<!--
Thank you for creating a backmerge PR! 🔄
This template is specifically for backmerge pull requests. Please ensure all the following sections are properly filled out.
-->

## 🔄 Backmerge Incoming!

A backmerge operation is being performed to integrate released packages back into the develop branch. This ensures that the develop branch stays up-to-date with the latest stable releases.

## 📋 Backmerge Checklist

- [ ] Create new branch from `main`: `chore/backmerge`
- [ ] Create Pull Request targeting `develop` using template `gh pr create -B develop --title "🔀 (release) [NO-ISSUE]: Backmerge release into develop" -T .github/pull_request_backmerge_template.md`
- [ ] Revert private flags (`revert-private.cjs`)
  - [ ] Verify that all relevant packages have `private: false` set in their `package.json` files
- [ ] Restore workspace deps (`unpin-deps.cjs`)
- [ ] Update lockfile (`pnpm install`)

```bash
pnpm exec zx .cursor/scripts/release/revert-private.cjs
pnpm exec zx .cursor/scripts/release/unpin-deps.cjs
pnpm install
```

- [ ] Commit the reset:

```bash
git commit -m "🔧 (release): Reset private packages after release"
```

- [ ] Fix conflicts with develop branch if needed:
  - [ ] ⚠️ **NO REBASE!** Merge develop into backmerge branch for fixing conflicts
  - [ ] Resolve all merge conflicts manually
  - [ ] Test resolution locally
- [ ] Complete merge process
- [ ] Create PR in Ledger Live with updated libs:
  - [ ] Adapt code if needed (breaking changes)
  - [ ] Update all released packages
