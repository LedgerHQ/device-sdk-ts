---
name: apdu-commands
description: Name a Ledger APDU from its CLA and INS bytes, for the OS, the dashboard and every app DMK has a signer for. Use when an APDU in the selection has no command name, or to check one.
---

# APDU commands

`commands.md`, next to this file, lists every command DMK, its signers and its trusted apps can send, by CLA and INS (the first two bytes of the APDU), grouped by who answers it:

- **Any app or the dashboard (CLA b0)**: the same meaning whatever is open.
- **Dashboard only (BOLOS)**: CLA e0 commands of the dashboard. Inside an app the same bytes belong to that app.
- **One section per app**, under the name the device reports in `getAppAndVersion` (`Ethereum`, `Solana`, `Bitcoin Cash`, …).

To name an APDU, find which app was open when it was sent (see `explain-device-exchange`), then look up CLA and INS in that app's section. When several names share a line, P1 and P2 tell them apart (for example the first chunk of a transaction against the next ones).

An app missing from `commands.md` has no DMK signer (for example Cardano or Stellar): say the command is unknown to DMK rather than guessing from another app, since apps reuse the same CLA and INS for different commands.
