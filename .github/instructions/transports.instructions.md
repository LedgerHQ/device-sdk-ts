---
applyTo: "packages/transport/**"
---

# Transports (`packages/transport/*`)

A transport implements the DMK `Transport` interface (`packages/device-management-kit/src/api/transport/model/Transport.ts`):

- `getIdentifier`, `isSupported`
- `startDiscovering`, `stopDiscovering`, `listenToAvailableDevices`
- `connect`, `disconnect`

It is exposed through a `TransportFactory`.

## Runtime targets

Each package targets one runtime. Review against that runtime:

- `web-hid`, `web-ble`: browser. Portable-runtime rules apply: no `Buffer`, `process` or `node:*`.
- `rn-hid`, `rn-ble`: React Native / Hermes. Same portable rules. Avoid Web-only globals too (`URL`, `Blob`, `ReadableStream`, `AbortSignal.timeout`).
- `node-hid`: Node only. It uses `nodeRuntimeOverrides` in its ESLint config, so Node globals and `node:*` imports are allowed.
- `speculos`, `mockserver`: test and simulation transports.

## Review focus

- `connect` returns `Either<ConnectError, TransportConnectedDevice>`. Connection failures are typed errors. They don't throw.
- Observables:
  - Resources opened by `startDiscovering` (scans, listeners) are released by `stopDiscovering`. It can be a no-op when discovery holds no resource (see `WebHidTransport`).
  - `listenToAvailableDevices` is a long-lived stream: it is not tied to discovery, but each subscription must release its resources when unsubscribed.
  - Watch for leaked subscriptions, timers and event listeners on disconnect.
- APDU framing (HID 64-byte frames, BLE MTU negotiation): check the sequence indexes and the length handling.
- Reconnection and disconnection: the disconnect handler must be called once, and pending exchanges must be rejected.

## Do not flag

- Byte data as `Uint8Array` instead of `Buffer` (required).
- `_`-prefixed private fields.
- RxJS patterns (`Subject`, `BehaviorSubject`) used for device lists.
