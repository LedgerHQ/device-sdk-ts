---
"@ledgerhq/device-transport-kit-react-native-hid": patch
---

Encode and decode Base64 through the shared portable Device Management Kit helpers (`bufferToBase64String`/`base64StringToBuffer`) instead of the bare `btoa`/`atob` globals.
