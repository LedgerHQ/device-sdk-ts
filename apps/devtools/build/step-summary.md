## Devtools Desktop App Build

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
