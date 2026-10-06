# @ledgerhq/device-mockserver-react

The live screen of a [device mock server](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/device-mock-server) device,
with the controls to drive it: touch for Stax, Flex and Apex, left / right /
both buttons for the Nano. A device that runs no app has no Speculos instance,
so its record from the mock server is shown instead.

Built with [Lumen](https://www.npmjs.com/package/@ledgerhq/lumen-ui-react), so
the host renders it inside a Lumen `ThemeProvider` and a Tailwind build.

## Usage

```tsx
import { MockServerDevice } from "@ledgerhq/device-mockserver-react";

<MockServerDevice
  url="http://127.0.0.1:9752"
  token={sessionToken}
  deviceId={deviceId}
  floating
/>;
```

| Prop               | Description                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| `url`              | Mock server URL.                                                                     |
| `token`            | Token of the session that owns the device.                                           |
| `deviceId`         | Mock server device id.                                                               |
| `floating`         | A window over the page, dragged by its header and collapsed to it. Inline otherwise. |
| `defaultCollapsed` | Whether the floating window starts collapsed.                                        |

`DeviceScreen` renders the same screen from any `ScreenApi`, for instance one
that talks to Speculos directly. `mockServerScreenApi(client, deviceId)` is the
one `MockServerDevice` uses, for hosts that already hold a `MockClient` (any
object with the `MockServerClient` methods fits), and
`findDeviceScreenModel(deviceType)` gives a model's label for their own header.

## Styles

Tailwind skips `node_modules`, so register the package next to Lumen in the
host stylesheet:

```css
@import "@ledgerhq/lumen-ui-react/tailwind.css";
@import "@ledgerhq/device-mockserver-react/tailwind.css";
```
