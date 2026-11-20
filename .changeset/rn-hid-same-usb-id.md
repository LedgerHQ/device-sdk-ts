---
"@ledgerhq/device-transport-kit-react-native-hid": minor
---

Give a USB device the same id in discovery and after connect. Breaking: the discovered id changes from the Android device number (`1005`) to `usb_1005`. After a re-enumeration, discovery gives the id of the open session.
