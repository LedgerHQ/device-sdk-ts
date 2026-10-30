---
name: explain-device-exchange
description: Explain a selection of Device Management Kit (DMK) logs or APDU exchanges between an app and a Ledger device - what happened, in order, and why it succeeded or failed. Use for every request from the Ledger DMK DevTools.
---

# Explaining a device exchange

The DevTools sends you a selection of either DMK logs or APDU exchanges, oldest first. Explain what the app and the device did, and why it ended the way it did, so a developer can act on it.

## How to read the input

- **Log lines** look like `[time] [LEVEL] [tag] message | payload`. `[exchange] => …` is an APDU sent to the device, `[exchange] <= …` its response. A payload with `type: "apdu-exchange"` holds the whole exchange.
- **APDU lines** look like `[time] [layer] command | => <sent hex> | <= <received hex>`. The layer is `OS` or the name of the app that answered. The command name was worked out by the DevTools; trust it, but say so when it is missing.
- An APDU is `CLA INS P1 P2 Lc data`. The last 2 bytes of a response are the status word; `9000` is success.
- The open app changes only through the device: `b001` (getAppAndVersion) reports it, `e0d8` (openApp) opens one from the dashboard, `b0a7` (closeApp) goes back to the dashboard (`BOLOS`).
- Class `b0` commands are answered by every app the same way. Class `e0` means a dashboard command only when the dashboard is open; inside an app the same bytes belong to that app. Look commands up with the `apdu-commands` skill.
- DMK polls `getAppAndVersion` every 1 to 2 seconds while a session is idle. Mention those polls only when they matter (an app that closed, a device that stopped answering).

Use the `dmk-flows` skill for what DMK does around the APDUs (sessions, device actions, common failures) and `status-words` for what a status word means.

## How to answer

Answer in Markdown with exactly these sections, in this order, and nothing before the first one:

## What happened
Two or three sentences: the operation the app attempted (for example "sign an Ethereum transaction with clear signing"), on which app and version when known.

## Sequence
A fenced block with the language `sequence`, one message per line, `App -> Device: <what>` or `Device -> App: <what>`. Group repeated chunks into one line ("signTransaction, 4 chunks"). Put the status word and its name on responses. At most 12 lines.

## Result
Start with `Succeeded:` or `Failed:` and a short reason on the same line. Then say exactly where it went right or wrong: the time, the command and the status word.

## Why
The cause, from what the logs show. When the cause is a guess, say it is one and what would confirm it.

## Try next
One to three concrete next steps for the developer, or "Nothing to do" when it succeeded as intended.

Rules:
- Quote real times, hex and status words from the input; never invent values.
- Keep it short: a developer reads this beside the logs.
- When the selection is too small to tell what happened, say what is missing (for example "select the openApp exchange before this").
