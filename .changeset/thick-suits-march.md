---
"@ledgerhq/device-management-kit": minor
"@ledgerhq/device-transport-kit-mockserver": patch
"@ledgerhq/device-transport-kit-react-native-ble": patch
"@ledgerhq/device-transport-kit-react-native-hid": patch
"@ledgerhq/device-transport-kit-speculos": patch
"@ledgerhq/device-transport-kit-web-ble": patch
"@ledgerhq/device-transport-kit-web-hid": patch
---

Breaking change: Replace TransportDeviceModel.blockSize by dynamic getBlockSize (where the result depends on the firmware version). This allows us to correctly handle available memory prediction for the Ledger Nano S.
