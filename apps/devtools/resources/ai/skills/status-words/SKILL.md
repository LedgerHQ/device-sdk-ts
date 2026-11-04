---
name: status-words
description: Meaning and usual cause of a Ledger APDU status word (the last 2 bytes of a response). Use for any status word other than 9000.
---

# Status words

`9000` is success. An app may give a word its own meaning: prefer it when the logs make it clear.

| SW | Meaning | Usually |
|---|---|---|
| 5515 | Device locked | PIN not entered yet; DMK waits and retries. |
| 5501 | Refused on device | The user rejected an OS screen (allow Ledger Live, open app). |
| 5502 | PIN not set | The device is not onboarded. |
| 5223 | Internal error | Firmware; retry, then report with the firmware version. |
| 6e00 | CLA not supported | Wrong app open, or the dashboard when an app was expected. |
| 6d00 | INS not supported | Wrong app, or an app too old for the command. |
| 6807 | App not installed | openApp on the dashboard. |
| 670a | Empty app name | openApp on the dashboard. |
| 6985 | Condition not satisfied | In signing apps, the user rejected. |
| 6982 | Security status not satisfied | Locked, or the user cancelled. |
| 6a80 | Invalid data | The app could not parse the payload or descriptor: encoding, unsupported type, version mismatch. |
| 6a86, 6b00 | Wrong P1/P2 | A mode this app version lacks, or wrong chunking. |
| 6700 | Wrong length | Lc does not match the data, or a chunk is too long. |

Any other word is app-specific: say so and point to the app's APDU specification.
