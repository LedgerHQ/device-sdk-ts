---
"@ledgerhq/device-transport-kit-react-native-ble": patch
---

Fix BLE scan delay: first scanned devices now appear immediately instead of being delayed by ~1s due to the throttle window being consumed by an initial empty emission
