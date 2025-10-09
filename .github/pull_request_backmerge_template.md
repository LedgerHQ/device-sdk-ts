<!--
Thank you for creating a backmerge PR! 🔄
This template is specifically for backmerge pull requests. Please ensure all the following sections are properly filled out.
-->

## 🔄 Backmerge Incoming!

A backmerge operation is being performed to integrate released packages back into the develop branch. This ensures that the develop branch stays up-to-date with the latest stable releases.

## 📋 Backmerge Checklist

- [ ] Create new branch from `main`: `chore/backmerge`
- [ ] Create Pull Request targeting `develop` using template `gh pr create -B develop --title "🔀 (release) [NO-ISSUE]: Backmerge release into develop" -T .github/pull_request_backmerge_template.md`
- [ ] Run `pnpm ldmk-tool exit-release`
  - [ ] Verify that all relevant packages have `private: true` set in their `package.json` files
- [ ] fix conflicts with develop branch if needed:
  - [ ] ⚠️ **NO REBASE!** Merge develop into backmerge branch for fixing conflicts
  - [ ] Resolve all merge conflicts manually
  - [ ] Test resolution locally
- [ ] Complete merge process
- [ ] Create PR in Ledger Live with updated libs:
  - [ ] Adapt code if needed (breaking changes)
  - [ ] Update all released packages
