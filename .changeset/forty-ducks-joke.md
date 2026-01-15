---
"@ledgerhq/device-transport-kit-react-native-ble": minor
---

Add `PairingRefusedQuicklyError` to distinguish automatic pairing rejections from deliberate user refusals. When pairing is refused in less than 1 second, this typically indicates the device is locked (locked devices auto-reject pairing). Applications can catch this specific error to prompt users to unlock their device and retry.
