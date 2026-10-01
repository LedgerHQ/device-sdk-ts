---
"@ledgerhq/dmk-ledger-wallet": minor
---

`FlashMcuDeviceAction` now returns whether it flashed the MCU or the bootloader. A `target` of `"mcu"` ends the flash loop; `"bootloader"` is followed by another flash.
