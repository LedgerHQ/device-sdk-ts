# @ledgerhq/device-transport-kit-mockserver

A Device Management Kit (DMK) transport that connects to fake devices on the [device mock server](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/device-mock-server) instead of physical Ledger devices. Use it for automated and manual tests with no hardware.

## Usage

Give the transport and DMK the token of the session that holds your devices:

```ts
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import { MockClient } from "@ledgerhq/device-mockserver-client";
import { mockserverTransportFactory } from "@ledgerhq/device-transport-kit-mockserver";

const MOCK_SERVER_URL = "http://127.0.0.1:9752";

const token = await new MockClient(MOCK_SERVER_URL).authenticate();

const dmk = new DeviceManagementKitBuilder()
  .addTransport(mockserverTransportFactory(MOCK_SERVER_URL, token))
  .addConfig({
    mockUrl: MOCK_SERVER_URL,
    // Genuine check and app management use this WebSocket, not the transport.
    webSocketUrl: `ws://127.0.0.1:9752/secure-channel/${token}`,
  })
  .build();
```

`mockserverTransportFactory(url?, token?)`:

- With no `url`, the transport uses DMK's `mockUrl`. Its default is Ledger's hosted instance, which you can reach only on the Ledger VPN.
- With no `token`, the transport creates its own session. No other client can then add devices or mocks to it.

The transport identifier is `mockserverIdentifier` (`"MOCKSERVER"`). The transport asks the server for its devices every second, so a device added to the session appears in DMK's discovery, and a device deleted or disconnected through the API disconnects in DMK.

## Documentation

The [mock server guide](https://github.com/LedgerHQ/device-sdk-ts/tree/develop/apps/device-mock-server#readme) explains why `webSocketUrl` needs the token, how to add devices and mocks with `@ledgerhq/device-mockserver-client`, and how to write automated and manual tests.
