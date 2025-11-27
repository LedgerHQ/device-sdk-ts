<!--
Thank you for creating a release PR! 🚀
This template is specifically for release pull requests. Please ensure all the following sections are properly filled out.
-->

## 🚀 Release Incoming!

A new release is being prepared with the latest updates, improvements, and fixes. Please review the details below and ensure all release steps are completed before merging.

## 📦 Release Information

<!--
Delete unused package/version lines below and replace version comment with the correct released version number.
-->

### Packages

- **Device Management Kit**: <!-- version -->
- **Device Management Kit Flipper Plugin Client**: <!-- version -->
- **Device Mockserver Client**: <!-- version -->

### Signer Kits

- **Device Signer Kit Bitcoin**: <!-- version -->
- **Device Signer Kit Ethereum**: <!-- version -->
- **Device Signer Kit Solana**: <!-- version -->
- **Context Module**: <!-- version -->
- **Signer Utils**: <!-- version -->

### Transport Kits

- **Device Transport Kit React Native BLE**: <!-- version -->
- **Device Transport Kit Mockserver**: <!-- version -->
- **Device Transport Kit Speculos**: <!-- version -->
- **Device Transport Kit React Native HID**: <!-- version -->
- **Device Transport Kit Web BLE**: <!-- version -->
- **Device Transport Kit Web HID**: <!-- version -->

## 📋 Release Checklist

- [ ] Create new branch from `develop`: `release`
- [ ] Create Pull Request targeting `main` using template `gh pr create -B main --title "🔖 (release) [NO-ISSUE]: New release incoming" -T .github/pull_request_release_template.md`
- [ ] Run `pnpm ldmk-tool enter-release` and select packages to release
- [ ] Run `pnpm ldmk-tool bump` to consume changesets and generate `CHANGELOG.md` files:
  - [ ] Ensure `GITHUB_TOKEN` environment variable is set with SSO
  - [ ] Manually verify all generated versions
  - [ ] Check peer dependencies versions (changeset bug workaround)
- [ ] Quality Assurance:
  - [ ] Test in Sample App
  - [ ] Review and update documentation
    - [ ] Update `apps/docs/pages/docs/getting-started.mdx`:
    - [ ] Document API changes
    - [ ] Document breaking changes
- [ ] Review and merge into `main` branch

## ✅ Final Checklist for Release Reviewers

- [ ] Version number follows semantic versioning
- [ ] Changelog is complete and accurate
- [ ] Release notes are clear and user-friendly
- [ ] All security vulnerabilities are addressed
- [ ] Dependencies are up-to-date and secure
- [ ] Documentation is updated
- [ ] CI/CD pipeline is passing
- [ ] Release has been tested in staging environment (if applicable)

---
