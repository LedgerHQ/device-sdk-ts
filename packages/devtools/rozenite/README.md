# Device Management Kit Devtools Rozenite

Rozenite connector for DMK developer tools in React Native apps.

## Getting Started

See [React Native devtools setup](../../device-management-kit/README.md#react-native-app-with-rozenite) for installation and usage instructions.

For architecture details, see the [devtools-core README](../core/README.md#architecture).

## Limitations

- **No AI debugging yet.** It runs Claude Code on your computer, which a Rozenite panel cannot do, so the AI buttons are disabled. To use it, connect your app to the desktop app (`apps/devtools`) with the [WebSocket setup](../../device-management-kit/README.md#web-nodejs-or-electron-app).

## Development

In order to test in dev mode, run the host app with

`ROZENITE_DEV_MODE=@ledgerhq/device-management-kit-devtools-rozenite react native start`
or
`ROZENITE_DEV_MODE=@ledgerhq/device-management-kit-devtools-rozenite expo start`
