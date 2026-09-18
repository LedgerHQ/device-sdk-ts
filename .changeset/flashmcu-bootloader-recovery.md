---
"@ledgerhq/dmk-ledger-wallet": minor
---

Add a bootloader recovery mode to `FlashMcuDeviceAction`. `FlashMcuDAInput` now
takes a `mode`: `{ mode: "osUpdate", finalFirmware }` keeps the previous
behaviour, while `{ mode: "bootloaderRecovery" }` resolves the MCU from what the
device reports, for a device stuck in bootloader mode with no known update path.

The forced MCU versions are now per mode, matching the two legacy flows: an OS
update only aliases a bootloader reporting no version, and resolves everything
else from the MCU catalog constrained by the firmware being installed, while a
recovery keeps the full set of hops. An OS update on a device reporting
bootloader `0.6`, `0.7` or `0.9` previously skipped the catalog and ignored the
final firmware.
