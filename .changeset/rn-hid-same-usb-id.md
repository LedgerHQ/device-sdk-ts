---
"@ledgerhq/device-transport-kit-react-native-hid": minor
---

Give a USB device the same id in discovery and after connect. The discovered id changes from the Android device number (`1005`) to `usb_1005`, the id that the session already used. After a re-enumeration, discovery gives the id of the open session.
