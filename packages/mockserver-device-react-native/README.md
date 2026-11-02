# @ledgerhq/device-mockserver-react-native

The live screen of a [device mock server](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/device-mock-server) device
in a React Native app, with the controls to drive it: touch for Stax, Flex
and Apex, left / right / both buttons for the Nano. A device that runs no app
has no Speculos instance, so its installed apps are listed instead, ready to
open.

Plain React Native components: no design system and no native module to
install.

## Usage

```tsx
import { MockServerDevice } from "@ledgerhq/device-mockserver-react-native";

<MockServerDevice
  url="http://127.0.0.1:9752"
  token={sessionToken}
  deviceId={deviceId}
/>;
```

| Prop          | Description                                                         |
| ------------- | ------------------------------------------------------------------- |
| `url`         | Mock server URL.                                                    |
| `token`       | Token of the session that owns the device.                          |
| `deviceId`    | Mock server device id.                                              |
| `colorScheme` | `"light"` or `"dark"`, for the controls. The system's when omitted. |

The screen renders inline, as wide as its container. Where it goes, an overlay,
a sheet or a debug screen, is the host's choice. It polls the mock server while
mounted and pauses while the app is in the background, so a host hiding it
unmounts it.

`DeviceScreen` renders the same screen from any `ScreenApi`.
`mockServerScreenApi(client, deviceId)` is the one `MockServerDevice` uses, for
hosts that already hold a `MockClient`.

## Limits

- React Native's `Image` has no pixelated scaling, so a Nano's small screen
  looks soft when drawn large.
- Each new frame is a new data URI. The screen redraws only when the frame
  changes.
