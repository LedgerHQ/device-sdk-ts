---
name: status-words
description: What the status word (last 2 bytes) of a Ledger device APDU response means, and what usually causes it. Use when explaining any APDU response other than 9000.
---

# Status words

The last 2 bytes of every response are the status word (SW). `9000` is success. The same SW can mean slightly different things in different apps; prefer the app's meaning when the logs make it clear.

## Answered the same way everywhere (DMK's global errors)

| SW | Meaning | Usual cause |
|----|---------|-------------|
| 9000 | Success | |
| 5515 | Device is locked | The user has not entered the PIN yet; DMK waits and retries. |
| 5501 | Action refused on device | The user pressed Reject on an OS screen (for example "Allow Ledger Live", open app). |
| 5502 | PIN not set | The device is not onboarded. |
| 5223 | Device internal error | Firmware problem; retry, then report with the firmware version. |
| 6e00 | CLA not supported | The command was sent to the wrong app (or to the dashboard when an app was expected). |
| 6d00 | INS not supported | The app does not know this instruction: wrong app, or an app version too old for the command. |

## Common on the dashboard

| SW | Command | Meaning |
|----|---------|---------|
| 6807 | openApp | No app with that name is installed. |
| 670a | openApp | The app name was empty. |

## Common in apps

| SW | Usual meaning |
|----|---------------|
| 6985 | Condition not satisfied. In most signing apps this is the user pressing Reject on the device. |
| 6982 | Security status not satisfied: the device is locked, or the user cancelled. |
| 6a80 | Invalid data: the app could not parse what was sent (wrong encoding, unsupported transaction type, bad descriptor). |
| 6a86 / 6b00 | Wrong P1/P2: the app version does not support this mode, or the chunking is wrong. |
| 6700 | Wrong length: Lc does not match the data, or a chunk is too long. |

An SW not listed here is app-specific: say so, and point to the app's APDU specification.
