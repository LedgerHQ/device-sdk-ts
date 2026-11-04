---
# readAnswer in src/main/aiOptions.ts reads the Verdict section: change both together
name: explain-device-exchange
description: Explain a selection of DMK logs or APDU exchanges from the Ledger DMK DevTools - what happened, in order, and why. Use for every DevTools request.
---

# Explaining a device exchange

The selection is DMK logs or APDU exchanges, oldest first. Explain what the app and the device did and why it ended that way, so a developer can act on it.

## Reading the input

- Log lines: `[time] [LEVEL] [tag] message | payload`. `[exchange] =>` is an APDU sent, `<=` its response; a `type: "apdu-exchange"` payload holds both.
- APDU lines: `[time] [layer] command | => sent | <= received`. The layer is `OS` or the app that answered. The DevTools named the command: trust it, and say when it is missing.
- An APDU is `CLA INS P1 P2 Lc data`; a response ends with the 2-byte status word, `9000` is success.
- The open app changes only through the device: `b001` getAppAndVersion reports it, `e0d8` openApp opens one, `b0a7` closeApp returns to the dashboard (`BOLOS`). CLA `b0` means the same in every app; CLA `e0` is a dashboard command only while the dashboard is open.
- Idle sessions poll `getAppAndVersion` every 1 to 2 seconds: mention polls only when they matter.

Use `status-words` for any status word other than `9000`, `apdu-commands` for an APDU without a name, `dmk-flows` for what DMK does around the APDUs, and `is-it-a-bug` for the verdict.

## Answer

Markdown with exactly these sections, in this order, and nothing before the first:

## What happened

Two or three sentences: the operation attempted, on which app and version when known.

## Sequence

A fenced block with the language `sequence`, one message per line: `App -> Device: <what>` or `Device -> App: <what>`. Status word and its name on responses; repeated chunks on one line ("signTransaction, 4 chunks"). At most 12 lines.

## Result

`Succeeded:` or `Failed:` and a short reason, then where: time, command, status word.

## Why

The cause the logs show. Mark a guess as one and say what would confirm it.

## Try next

One to three concrete steps, or "Nothing to do".

## Verdict

First line `Bug:`, `Not a bug:` or `Needs a closer look:` and one sentence. A success is `Not a bug: it worked.`

Quote real times, hex and status words; never invent values. Keep it short. When the selection is too small, say what to add (for example "select the openApp exchange before this").
