---
name: is-it-a-bug
description: Decide whether a failure in DMK logs or APDU exchanges is a bug someone must fix or expected behaviour. Use for the Verdict section of every explanation.
---

# Is it a bug?

Most failures are not bugs: the device or the user did what it should. Call it a bug only when software did the wrong thing, and name which.

## Not a bug

- The user rejected on the device: `6985`, `5501` or `6982` right after a screen.
- The device was locked: `5515` on polls, then success after the unlock.
- `6e00` or `6d00` with the wrong app open, then DMK opening the right one.
- The app is not installed (`6807`), or too old for a command and reported as such: a setup note at most.
- The device was unplugged or asleep, or the user never acted before a timeout.

## A bug, and whose

- **DMK**: a malformed APDU (length, P1/P2 for the app version, chunking), a response ignored or mis-parsed, a loop, a device action ending with the wrong error or none, or a transport or session that loses or reorders messages or contradicts the APDUs (for example "locked" while the device answers `9000`).
- **signer-… or context module**: a wrong payload or descriptor, so the app answers `6a80` or falls back to blind signing where clear signing was expected.
- **The device app or firmware**: an error or a wrong result for a well-formed command.
- **Mock server**: an answer a real device would not give.
- **Host app**: DMK used in a way it does not support (for example two device actions at once).

When you cannot tell, say `Needs a closer look:` and what would decide it (a longer selection, the app version, the same flow on a real device).

## Writing the verdict

The first line starts with `Bug:`, `Not a bug:` or `Needs a closer look:` and one sentence. For a bug, add:

- Component: <DMK | signer-… | context module | <app> app | firmware | mock server | host app>
- Severity: <blocker | major | minor>
