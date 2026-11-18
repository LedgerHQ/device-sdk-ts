# @ledgerhq/device-mockserver-client

The typed client of the [device mock server](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/device-mock-server), a server that emulates Ledger devices for apps built on the Device Management Kit (DMK).

Use it from a test or a tool to create a session, add fake devices and APDU mocks, and drive the device screen while an app runs on Speculos. To connect DMK itself to the mock server, use [`@ledgerhq/device-transport-kit-mockserver`](https://www.npmjs.com/package/@ledgerhq/device-transport-kit-mockserver).

## Usage

```ts
import { MockClient } from "@ledgerhq/device-mockserver-client";

const client = new MockClient("http://127.0.0.1:9752");

// Create a session. Give this token to the DMK transport so that the app
// and this client see the same devices.
const token = await client.authenticate();

const device = await client.addDevice({
  device_type: "stax",
  firmware_version: "1.9.1",
});

// Make GetAppAndVersion report a locked device.
await client.addMock(device.id, { prefix: "b0010000", response: "5515" });

// ... run the app or the test, then:
await client.disposeSession();
```

| Option      | Description                                                                           |
| ----------- | ------------------------------------------------------------------------------------- |
| `token`     | Join an existing session. Without it, the client creates a session on its first call. |
| `timeoutMs` | Stop each request after this many milliseconds. No timeout by default.                |

## Documentation

The [mock server guide](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/device-mock-server#readme) covers:

- the hosted instance and how to run the server locally,
- how to connect a DMK app,
- every `MockClient` method and the device fields,
- how mocks match APDUs, with the common error cases,
- how to run real apps on Speculos and script the device screen,
- recipes for automated and manual tests.
