---
"@ledgerhq/device-transport-kit-react-native-ble": patch
---

Handle the cancelConnection rejection in RNBleApduSender.closeConnection, which was reported as an unhandled promise rejection when the device had already disconnected
