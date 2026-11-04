---
name: apdu-commands
description: Name a Ledger APDU from its CLA and INS bytes, for the OS, the dashboard and every app with a DMK signer. Use when an APDU has no command name, or to check one.
---

# APDU commands

`commands.md`, beside this file, lists every command DMK, its signers and its trusted apps send, by CLA and INS. Its sections: CLA `b0` (answered the same by any app or the dashboard), the dashboard (`BOLOS`), then one per app under the name `getAppAndVersion` reports.

Find the app open when the APDU was sent, then its line in that app's section; P1 and P2 tell apart the names sharing a line. An app without a section has no DMK signer (for example Cardano or Stellar): say DMK does not know the command, and never borrow another app's meaning, since apps reuse CLA and INS.
