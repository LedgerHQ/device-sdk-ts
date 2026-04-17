<!--
Thank you for creating a release PR! 🚀
This template is specifically for release pull requests. Please ensure all the following sections are properly filled out.
-->

## 🚀 Release Incoming!

A new release is being prepared with the latest updates, improvements, and fixes. Please review the details below and ensure all release steps are completed before merging.

## 📦 Release Information

<!-- Release information -->

### Core

- **Device Management Kit**: <!-- version -->

### Signer Kits

- **Device Signer Kit Ethereum**: <!-- version -->
- **Device Signer Kit Bitcoin**: <!-- version -->
- **Device Signer Kit Solana**: <!-- version -->
- **Device Signer Kit Aleo**: <!-- version -->
- **Device Signer Kit Cosmos**: <!-- version -->
- **Device Signer Kit HyperLiquid**: <!-- version -->
- **Device Signer Kit Zcash**: <!-- version -->
- **Context Module**: <!-- version -->
- **Signer Utils**: <!-- version -->

### Transport Kits

- **Device Transport Kit Web HID**: <!-- version -->
- **Device Transport Kit Web BLE**: <!-- version -->
- **Device Transport Kit Node HID**: <!-- version -->
- **Device Transport Kit React Native BLE**: <!-- version -->
- **Device Transport Kit React Native HID**: <!-- version -->
- **Device Transport Kit Speculos**: <!-- version -->
- **Device Transport Kit Mockserver**: <!-- version -->

### Trusted Apps

- **Ledger Keyring Protocol**: <!-- version -->

### Developer Tools

- **DevTools Core**: <!-- version -->
- **DevTools UI**: <!-- version -->
- **DevTools Rozenite**: <!-- version -->
- **DevTools WebSocket Common**: <!-- version -->
- **DevTools WebSocket Connector**: <!-- version -->
- **DevTools WebSocket Server**: <!-- version -->

<!-- End Release information -->

## 📋 Release Checklist

This release is driven by the agent release skill (`.cursor/skills/release/SKILL.md`).
The skill automates the steps below via scripts in `.cursor/scripts/release/`.

- [ ] Create `release` branch from `develop`
- [ ] Run `proto use` and `pnpm install`
- [ ] Set private flags (`set-private.cjs`)
- [ ] Pin workspace deps (`pin-deps.cjs`)
- [ ] Bump versions (`bump.cjs`)
- [ ] Generate changelogs (`changelog.cjs`)
- [ ] Clean up consumed changesets (`cleanup.cjs`)
- [ ] Update lockfile (`pnpm install --no-frozen-lockfile`)
- [ ] Update `apps/docs/pages/docs/getting-started.mdx`
- [ ] Create this PR (`create-pr.cjs`)
- [ ] Quality Assurance:
  - [ ] Test in Sample App
  - [ ] Review and update documentation
    - [ ] Document API changes
    - [ ] Document breaking changes
- [ ] Review and merge into `main` branch

## ✅ Final Checklist for Release Reviewers

- [ ] Version numbers follow semantic versioning
- [ ] Changelogs are complete and accurate
- [ ] Release notes are clear and user-friendly
- [ ] All security vulnerabilities are addressed
- [ ] Dependencies are up-to-date and secure
- [ ] Documentation is updated
- [ ] CI/CD pipeline is passing

---
