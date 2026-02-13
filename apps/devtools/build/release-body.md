Latest build of the Devtools Desktop App.

**Source:** ${SOURCE_REF}
**Workflow run:** ${WORKFLOW_URL}

> This release is automatically updated on every build. Download the binary for your platform below.

---

### macOS — bypass Gatekeeper for unsigned builds

These builds are **not code-signed**. macOS will quarantine them on download.
Before opening the app, run:

```sh
xattr -cr "Ledger DMK DevTools.app"
```

Or if you downloaded the `.dmg`, after mounting it:

```sh
xattr -cr /Volumes/Ledger\ DMK\ DevTools/Ledger\ DMK\ DevTools.app
```
