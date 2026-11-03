# @ledgerhq/device-mockserver-react-core

The platform-free part of the [device mock server](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/device-mock-server)
screens: React hooks and helpers with no DOM, React Native or design system
import. [`@ledgerhq/device-mockserver-react`](../mockserver-device-react) draws
it for the web.

Use that package to show a device screen. Use this one directly only to build
a screen for another platform.

## Contents

| Export                                                | Role                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `useScreenPolling(api, polling, platform)`            | Polls the screen: a live frame, the device record while no app runs, or an error.                  |
| `ScreenPlatform`                                      | What the platform supplies: how a frame becomes an image source, and when the app is hidden.       |
| `mockServerScreenApi(client, deviceId)`               | A `ScreenApi` that reaches a device through the mock server.                                       |
| `useMockServerDevice(client, deviceId)`               | The mock server's record of a device.                                                              |
| `findDeviceScreenModel(deviceType)`                   | Touch or buttons, screen size and colour of a device model.                                        |
| `useHold(onAction)`                                   | Sends a quick click or tap as one press-and-release, and a longer hold as a press, then a release. |
| `useButtonHold(onPress)`, `useTouchHold(onTouch)`     | `useHold` for the Nano buttons, and for touches in device pixels.                                  |
| `toScreenPoint`                                       | Maps a point on the drawn screen to device pixels.                                                 |
| `useOpenApp(onOpenApp)`, `openableApps`, `appIconUrl` | Opens an app from the device's list and waits for its screen.                                      |

Pass `useScreenPolling` a `ScreenPlatform` defined at module level. Polling
restarts whenever the object changes.
