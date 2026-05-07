# React Native Bulk APDU Performance Analysis

## Context

Ledger Wallet uses `device-management-kit` for device communication. Bulk APDU workloads such as app installs, language pack installs, and OS update flows can send hundreds or thousands of maximum-size APDUs consecutively. Compared with the legacy LedgerJS stack, this path now has more structure: device actions, XState actors, session state, queueing, reconnection state, transport adapters, logging, and React-facing progress updates.

This document maps the current RN BLE and RN HID stacks, identifies likely performance bottlenecks, explains where reconnection state can matter, and compares the current implementation with the legacy `ledgerhq` React Native BLE/HID transports.

## Executive Summary

The biggest steady-state bottlenecks are probably not the reconnection state machine itself. The highest-risk areas are:

1. RN BLE writes one BLE frame at a time through `react-native-ble-plx`, with one awaited JS/native call per frame.
2. Bulk secure-channel/device-action flows emit progress and XState snapshots for every APDU, which can amplify React Native JS thread and render pressure.
3. Logging eagerly formats full APDUs and responses as hex strings before logger subscribers have a chance to filter debug logs.
4. The DMK TypeScript framer creates avoidable objects and UUIDs per frame, and the receiver does repeated array concatenation.
5. RN HID performs multiple JS/native serialization passes per exchange and has native Kotlin framing/copying/logging costs.
6. The current RN BLE connection path requests MTU but does not appear to request Android high connection priority, while the legacy LedgerJS BLE transport did.

If `writeWithoutResponse` is confirmed to be used, then write-with-response is probably not the regression. The remaining BLE concerns are still real: one awaited native write per frame, JS Base64 conversion per frame, connection priority, progress/log storms, and extra framework layers around every APDU.

## Current RN BLE Stack

Low to high:

1. `react-native-ble-plx`
   - Native BLE connection, MTU negotiation, GATT writes, notifications.
2. `packages/transport/rn-ble/src/api/transport/RNBleApduSender.ts`
   - Monitors notify characteristic.
   - Negotiates Ledger MTU with setup APDU.
   - Splits APDUs into frames via DMK framer.
   - Base64-encodes each frame and writes it with `writeWithoutResponse` if available.
   - Decodes notification Base64 and reassembles response frames.
3. `packages/transport/rn-ble/src/api/transport/RNBleTransport.ts`
   - Scanning, connect/disconnect, MTU request, service discovery.
   - Creates `RNBleApduSender`.
   - Wires the TypeScript `DeviceConnectionStateMachine`.
   - Handles reconnect attempts.
4. `packages/device-management-kit/src/api/transport/model/DeviceConnectionStateMachine.ts`
   - XState transport state machine.
   - Allows one APDU in flight.
   - Handles disconnect/reconnect states.
5. `packages/device-management-kit/src/internal/device-session/model/DeviceSession.ts`
   - Public session-level send path.
   - Intent queue for raw `sendApdu` and `sendCommand`.
   - Device actions bypass the per-APDU queue once they own the queue slot.
   - Dispatches session state events per APDU result.
6. Device actions and secure-channel tasks
   - `ConnectToSecureChannelTask` sends bulk APDUs from manager API.
   - `InstallLanguagePackageTask` sends an APDU file line by line.
   - `InstallAppDeviceAction` and `InstallOrUpdateAppsDeviceAction` wrap this in XState actors.

## Current RN HID Stack

Low to high:

1. Android USB APIs
   - `UsbDeviceConnection.bulkTransfer`
   - `UsbRequest.queue`
   - `UsbDeviceConnection.requestWait`
2. `packages/transport/rn-hid/android/.../AndroidUsbApduSender.kt`
   - Serializes APDU into 64-byte USB frames.
   - Sends each frame with synchronous `bulkTransfer`.
   - Reads response frames with `UsbRequest`.
   - Logs full APDU and response as hex strings.
3. `packages/transport/rn-hid/android/.../FramerService.kt`
   - Kotlin APDU framing and response reassembly.
4. `packages/transport/rn-hid/android/.../DeviceConnectionStateMachine.kt`
   - Native state machine.
   - Allows one APDU in flight.
   - Handles USB detach/attach reconnection.
5. `packages/transport/rn-hid/android/.../TransportHidModule.kt`
   - React Native bridge.
   - Base64-decodes APDU input.
   - Base64-encodes response output.
6. `packages/transport/rn-hid/src/api/bridge/DefaultNativeModuleWrapper.ts`
   - Converts `Uint8Array` APDU to Base64 string.
   - Maps native response Base64 back to `ApduResponse`.
7. `packages/transport/rn-hid/src/api/transport/RNHidTransport.ts`
   - Creates `TransportConnectedDevice`.
   - Subscribes to native logs and device-disconnected events.
8. `DeviceSession` and device actions
   - Same high-level DMK layer as RN BLE.

RN HID is Android-only in this package.

## Bulk APDU Hot Paths

### Secure Channel Bulk

`packages/device-management-kit/src/api/secure-channel/task/ConnectToSecureChannelTask.ts`

The `BULK` message path closes the WebSocket, then loops over `input.data`:

- Convert APDU hex string to `Uint8Array`.
- `await this._api.sendApdu(apdu)`.
- Validate the response.
- Emit progress with `subscriber.next(...)` once per APDU.

This is correct functionally, but for thousands of APDUs it means thousands of:

- APDU sends.
- Promise/microtask continuations.
- Observable emissions.
- XState snapshot updates in parent device actions.
- Potential React state updates in Ledger Wallet.

### Language Pack Install

`packages/device-management-kit/src/api/device-action/task/InstallLanguagePackageTask.ts`

This fetches a file, splits it by line, converts each hex APDU, sends it, and emits progress per APDU.

### App Install

`packages/device-management-kit/src/api/secure-channel/device-action/InstallApp/InstallAppDeviceAction.ts`

The install actor invokes `ConnectToSecureChannelTask` through `fromObservable`. Every progress event can become a state-machine snapshot and then a subscriber notification.

### Device Actions vs Raw `dmk.sendApdu`

For device actions, the outer action takes one `IntentQueueService` slot. Inside the action, `InternalApi.sendApdu` calls `_unsafeInternalSendApdu`, so the DMK intent queue is not paid once per APDU.

For callers using public `dmk.sendApdu` in a loop, each APDU pays:

- Intent enqueue.
- RxJS `Subject`.
- Optional RxJS timeout.
- `lastValueFrom`.
- Queue completion dispatch.

## Ranked Bottlenecks

### 1. RN BLE Per-Frame Native Writes

`RNBleApduSender.sendApdu` builds frames and writes them sequentially:

- `apduSender.getFrames(apdu)`
- for each frame:
  - `frame.getRawData()`
  - `Base64.fromUint8Array(...)`
  - `await this.write(...)`

Even when `writeWithoutResponse` is used, there is still one awaited JS/native boundary per BLE frame. Maximum-size APDUs usually span multiple frames. Thousands of APDUs multiply this cost.

The current write method chooses write-without-response when the selected characteristic supports it. If Ledger Wallet confirms that `writeWithoutResponse` is used, the remaining question is whether awaiting every write serializes native queueing more than necessary.

Risk: high.

Validation:

- Log `isWritableWithoutResponse` once per connection.
- Measure frame count per APDU.
- Measure total time spent in the write loop vs time waiting for the response notification.

### 2. Android BLE Connection Priority

Current RN BLE connect requests MTU:

- `RNBleTransport.connect`: `connectToDevice(params.deviceId, { requestMTU: DEFAULT_MTU })`
- `DEFAULT_MTU = 156`

Legacy LedgerJS RN BLE used connect options with:

- `requestMTU: 156`
- `connectionPriority: 1`

In `react-native-ble-plx`, connection priority matters on Android. If the current stack is missing high priority during bulk transfer, this can produce a real throughput regression even if `writeWithoutResponse` is used.

Risk: high on Android BLE.

Validation:

- Add `connectionPriority: 1` or call `requestConnectionPriority("High")` in an experiment.
- Compare app install throughput and BLE frame write timings before/after.

### 3. Progress and State Update Storms

Bulk APDU flows emit progress per APDU. That can trigger:

- Observable emissions.
- XState actor snapshots.
- `XStateDeviceAction` debug logs.
- Subscriber callbacks.
- Ledger Wallet React state updates and renders.

For app installs, progress is rounded to 2 decimals in `ConnectToSecureChannelTask`, so many adjacent APDUs may emit the same user-visible progress value anyway.

Risk: high for React Native app responsiveness.

Validation:

- Locally throttle progress to every 100 ms, every 1 percent, or every N APDUs.
- Compare JS FPS, dropped frames, and total transfer time.
- Check if Ledger Wallet updates React state for every progress event.

### 4. Eager Full-Payload Logging

DMK logs full APDUs and responses in multiple places:

- `DeviceSession._unsafeInternalSendApdu`
- `RNBleApduSender.sendApdu`
- `RNBleApduSender.receiveApdu`
- RN HID native `AndroidUsbApduSender`
- `XStateDeviceAction` logs state and internal/intermediate values on snapshots.

The problem is not only whether debug subscribers print logs. The message string is often formatted before calling `logger.debug`, so hex conversion has already happened.

Examples:

- `formatApduSendingLog(rawApdu)`
- `formatApduSentLog(apdu)`
- `formatApduReceivedLog(response)`
- `bufferToHexaString(...)`
- Kotlin `ByteArray.toHexadecimalString(...)`

Risk: high when debug or native transport logging is enabled; medium otherwise because eager formatting still happens.

Validation:

- Compare bulk transfers with no loggers, error-only loggers, and debug loggers.
- Profile `bufferToHexaString`, `toHexadecimalString`, `formatApdu*`, and `XStateDeviceAction` logging.

### 5. DMK Framing Object Churn

Current TypeScript framing is functionally necessary, but the implementation is heavier than it needs to be:

- `DefaultApduSenderService.getFrames` creates `Frame` and `FrameHeader` objects.
- `FrameHeader` gets a `uuid.v4()` per outgoing frame.
- `DefaultApduReceiverService.getFrameFromBytes` gets a `uuid.v4()` per incoming frame.
- The UUID is not serialized into the BLE frame raw data.
- `Frame.getRawData()` allocates a new `Uint8Array` and uses array spreads.
- `DefaultApduReceiverService.concatFrames` repeatedly concatenates `Uint8Array`s using spreads.

For typical APDU sizes, this may be smaller than BLE native write cost. For thousands of APDUs, it becomes measurable JS allocation and GC pressure.

Risk: medium to high depending on JS profiling.

Validation:

- Hermes profile for `uuid`, `getFrames`, `Frame.getRawData`, `concatFrames`.
- Microbenchmark `getFrames` and response reassembly for representative APDU sizes.

### 6. RN HID JS/Native Serialization

RN HID APDU send path:

- JS `Uint8Array` -> Base64 string.
- Native Base64 string -> `ByteArray`.
- Native USB exchange.
- Native response `ByteArray` -> Base64 string.
- JS Base64 string -> `Uint8Array`.
- JS response split into data/status.

The current JS encoder uses `reduce` and repeated string concatenation:

- `packages/transport/rn-hid/src/api/helpers/base64Utils.ts`

For thousands of APDUs, this is avoidable JS thread work.

Risk: medium to high on RN HID.

Validation:

- Hermes profile for `uint8ArrayToBase64`, `base64ToUint8Array`, `btoa`, `atob`.
- Replace encoder with a chunked or native-backed encoder in an experiment.

### 7. RN HID Native Framing and Logging

Kotlin `FramerService.deserialize` does:

- `payload += rawApdu`

This copies the accumulated payload each time. For multi-frame responses, that is avoidable. `AndroidUsbApduSender` also logs full APDU/response hex strings and forwards native transport logs to JS.

Risk: medium.

Validation:

- Android CPU profiler for `FramerService.deserialize`, `toHexadecimalString`, `Base64`, `bulkTransfer`.

### 8. Reconnection State

The reconnection state machine is probably not the steady-state bottleneck unless the link is unstable or calls overlap.

RN BLE `DeviceConnectionStateMachine`:

- One APDU in `SendingApdu`.
- If another `sendApdu` is called while one is in progress, it waits for the previous promise or up to `TRANSPORT_BUSY_WAIT_TIME = 10000`.
- If disconnected while sending, the current APDU fails with `DeviceDisconnectedWhileSendingError`.
- While waiting for reconnection, only one queued APDU is accepted; further calls get `AlreadySendingApduError`.

Potential performance symptoms:

- Overlapping APDU calls can create 10s stalls.
- Link instability during bulk transfer triggers full reconnect and service discovery.
- Current `RNBleApduSender` catches write errors, logs them, and then continues waiting for a response. In a device-action bulk flow with no per-APDU abort timeout, this can look like a hang.

Risk: low in healthy steady state; high if there are disconnects, write failures, or accidental concurrent sends.

Validation:

- Log state transitions and detect `WaitingForReconnection*`.
- Log when `apduInProgress.isJust()` causes the 10s wait path.
- Fail fast on frame write errors in an experiment.

## Framing: Can It Be More Efficient?

The Ledger framing itself is not optional. We need headers, chunk indexes, total APDU length on the first frame, and response reassembly. The opportunity is to keep the protocol but make the implementation less allocation-heavy.

### TypeScript Sender Improvements

Current sender creates a full object model:

- `FrameHeader`
- `Frame`
- `Maybe`
- `Either`
- per-frame UUID
- per-frame `getRawData()` allocation

More efficient options:

1. Remove `uuid.v4()` from hot-path frame construction unless it is actually needed for debug-only diagnostics. It is not serialized in `FrameHeader.getRawData()`.
2. Replace `getFrames(apdu): Frame[]` with an iterator/generator that yields raw `Uint8Array` frames. This avoids allocating an array of frame objects before writing.
3. Build each raw frame directly with a single `Uint8Array(frameLength)` and `set(...)`, instead of using spreads.
4. Compute offsets incrementally in one pass rather than calling `getFrameAtIndex` plus `getHeaderSizeSumFrom`.
5. Use `subarray` for APDU slices where safe. Copy only once into the final raw frame.
6. Precompute constant header sizes for "first frame" and "continuation frame".

Shape of a faster sender:

```ts
function* encodeApduFrames(
  apdu: Uint8Array,
  frameSize: number,
): Generator<Uint8Array> {
  let offset = 0;
  let index = 0;

  while (offset < apdu.length) {
    const headerLength = index === 0 ? 5 : 3;
    const dataLength = Math.min(apdu.length - offset, frameSize - headerLength);
    const frame = new Uint8Array(headerLength + dataLength);

    frame[0] = 0x05;
    frame[1] = (index >> 8) & 0xff;
    frame[2] = index & 0xff;

    if (index === 0) {
      frame[3] = (apdu.length >> 8) & 0xff;
      frame[4] = apdu.length & 0xff;
    }

    frame.set(apdu.subarray(offset, offset + dataLength), headerLength);
    yield frame;

    offset += dataLength;
    index += 1;
  }
}
```

This keeps the same wire format but removes most object churn.

### TypeScript Receiver Improvements

Current receiver stores parsed `Frame` objects, recomputes received length by reducing pending frames, and concatenates frames by repeatedly spreading `Uint8Array`s.

More efficient options:

1. Parse header directly from raw notification bytes.
2. On first frame, allocate a single output buffer of the announced APDU response size.
3. Keep mutable receiver state:
   - expected index
   - expected total length
   - current write offset
   - output buffer
4. Copy each frame payload directly into the output buffer.
5. When complete, create `ApduResponse` from final buffer slices.
6. Avoid per-frame UUIDs and `Frame` objects.

### Kotlin HID Improvements

Current Kotlin code can be improved without changing protocol:

1. Replace `payload += rawApdu` in `FramerService.deserialize` with a preallocated `ByteArray` or `ByteArrayOutputStream`.
2. Avoid `slice(...).toByteArray()` in tight loops where `copyInto` can fill preallocated frames.
3. Avoid full hex logging unless a debug subscriber is active.
4. Consider returning raw byte arrays through a JSI/TurboModule path if available later, rather than Base64 strings.

### BLE Write Pipelining?

Because `writeWithoutResponse` is likely used, it is tempting to pipeline several writes without awaiting each one. This needs care:

- BLE stacks have platform-specific backpressure and queue limits.
- Overfilling write-without-response can increase packet loss or OS-level errors.
- `react-native-ble-plx` may already serialize writes internally.
- Ledger devices still expect ordered frames.

A controlled experiment could test a small write window, for example 2 to 4 frames in flight, but this should not be the first optimization. It is more invasive than removing JS allocations, throttling progress, and restoring Android connection priority.

Another safer option is a native "send framed APDU" bridge method that accepts one Base64 APDU, frames it natively, writes frames natively, and resolves on response. That would reduce per-frame JS/native crossings while preserving native BLE flow control.

## Legacy LedgerJS Comparison

### Legacy RN BLE

Legacy package:

- `LedgerHQ/ledger-live/libs/ledgerjs/packages/react-native-hw-transport-ble`
- Main file: `src/BleTransport.ts`
- Framing helpers: `@ledgerhq/devices/ble/sendAPDU` and `@ledgerhq/devices/ble/receiveAPDU`

Similarities:

- Uses `react-native-ble-plx`.
- Requests MTU 156.
- Uses `writeWithoutResponse` when a writable-without-response characteristic exists.
- Sends APDU frames sequentially.
- Uses Base64 strings for BLE writes.
- Uses RxJS around send/receive.
- Uses an atomic exchange lock through `exchangeAtomicImpl`.

Differences that matter:

1. Legacy BLE sets Android connection priority in connect options:
   - `connectionPriority: 1`
   - Current RN BLE connect path only shows `requestMTU: DEFAULT_MTU`.
2. Legacy BLE framer is simpler:
   - `sendAPDU` slices a `Buffer`, allocates a small header, and `Buffer.concat`s header + data.
   - Current DMK framer creates `Frame`, `FrameHeader`, `Maybe`, `Either`, UUIDs, and raw data arrays.
3. Legacy BLE receiver is simpler:
   - It accumulates a `Buffer` with `Buffer.concat`.
   - It explicitly notes that response is often one chunk.
   - Current receiver stores frame objects and has extra parsing/model overhead.
4. Legacy BLE exchange combines send and receive with `merge(...)` in one `exchangeAtomicImpl`.
   - Current stack has `DeviceSession` -> `DeviceConnectionStateMachine` -> `RNBleApduSender` -> promise resolver -> XState event transitions.
5. Legacy BLE tracks transaction IDs and cancels pending BLE operations on timeout.
   - Current RN BLE timeout resolves the APDU promise, but frame write errors are swallowed in the send loop.
6. Legacy BLE has transport caching and queued disconnect behavior.
   - Current DMK has session/connection maps and reconnection state.

Conclusion:

If `writeWithoutResponse` is used in both stacks, the most likely legacy-vs-DMK regression sources are not the BLE write mode. They are connection priority, progress/log emissions, extra JS layers per APDU, and heavier framing/allocation.

### Legacy RN HID

Legacy package:

- `LedgerHQ/ledger-live/libs/ledgerjs/packages/react-native-hid`
- JS file: `src/index.ts`
- Native files:
  - `HIDDevice.java`
  - `LedgerHelper.java`
  - `ReactHIDModule.java`

Legacy JS `exchange`:

- Converts APDU `Buffer` to hex.
- Calls `NativeModules.HID.exchange(this.id, apduHex)`.
- Receives response hex.
- Converts response hex to `Buffer`.

Legacy native:

- Parses hex to bytes.
- `LedgerHelper.wrapCommandAPDU(...)` frames command with `ByteArrayOutputStream`.
- `HIDDevice.exchange(...)` runs on a single-thread executor.
- Writes 64-byte blocks using `UsbRequest`.
- Reads 64-byte blocks until `LedgerHelper.unwrapResponseAPDU(...)` returns full response.
- Resolves one hex response string.

Current RN HID differences:

1. Current uses Base64 rather than hex over the RN bridge.
   - Base64 is smaller than hex, but the current JS encoder uses repeated string concatenation.
2. Current has a Kotlin state machine and reconnection model.
   - Legacy was much simpler.
3. Current native logs full APDU and response and forwards transport logs to JS.
   - Legacy had native debug logging, but it was not the same DMK logger pipeline.
4. Current Kotlin `FramerService.deserialize` uses repeated `ByteArray` concatenation.
   - Legacy Java used `ByteArrayOutputStream` for response accumulation.
5. Current bridge returns structured success/error maps.
   - Legacy returned one hex string or rejected.

Conclusion:

RN HID moved some complexity native-side, but it still pays serialization and logging costs. Legacy HID was simpler and may have had less state/event/log overhead during bulk transfers.

## Reconnection Details

### RN BLE

Normal bulk transfer should remain in:

- `Connected`
- `SendingApdu`
- `Connected`

The reconnection states should only affect throughput if the BLE link disconnects or callers overlap transport sends.

Important states:

- `WaitingForReconnection`
- `WaitingForReconnectionWithQueuedSendApdu`
- `WaitingForDisconnection`

Potential issues:

- If `SendApduCalled` arrives while `SendingApdu`, the state machine returns `AlreadySendingApduError`.
- Before sending, `sendApdu` waits for the previous promise or up to 10 seconds if `apduInProgress` is still set.
- During reconnect, only one APDU can be queued.
- A disconnect during a send fails the current APDU.

### RN HID

RN HID uses a Kotlin state machine with similar states:

- `Connected`
- `SendingApdu`
- `WaitingForDisconnection`
- `WaitingForReconnection`
- `WaitingForReconnectionWithQueuedApdu`
- `Terminated`

It returns `DeviceBusy` if a second APDU is requested while sending.

## Profiling Plan

### BLE Transport Probes

Add temporary timing around:

1. `DefaultApduSenderService.getFrames`.
2. `RNBleApduSender` write loop.
3. Last write complete -> response notification complete.
4. `DefaultApduReceiverService.handleFrame`.

Log once per connection:

- platform
- requested MTU
- actual `device.mtu`
- derived Ledger frame size
- selected write characteristic UUID
- `isWritableWithoutResponse`
- whether Android connection priority is high

### DMK/Device Action Probes

Measure:

- bulk APDU count
- progress emissions count
- XState snapshots count
- React state updates count in Ledger Wallet
- `DeviceConnectionStateMachine` 10s wait path count
- reconnection state entries
- write errors

### Logging A/B

Run the same bulk workload with:

1. no loggers
2. error-only logger
3. debug logger
4. native RN HID transport log subscription disabled

### React Native Profiling

Use Hermes sampling profiler and look for:

- `Base64.fromUint8Array`
- `uint8ArrayToBase64`
- `base64ToUint8Array`
- `btoa` / `atob`
- `bufferToHexaString`
- `uuid`
- `DefaultApduSenderService.getFrames`
- `DefaultApduReceiverService.concatFrames`
- XState snapshot handling
- React render/update work caused by progress events

### Native Profiling

Android:

- BLE GATT write rate
- connection priority impact
- RN HID `Base64`
- `AndroidUsbApduSender.transmitApdu`
- `FramerService.deserialize`
- `ByteArray.toHexadecimalString`
- coroutine scheduling

iOS BLE:

- BLE write queue timing
- JS/native bridge overhead
- notification response timing

## Recommended Experiments

### High Confidence, Low Risk

1. Restore or test Android BLE high connection priority.
2. Throttle bulk progress emissions.
3. Disable or lazy-gate full APDU hex logging.
4. Remove per-frame UUID generation from sender and receiver.
5. Make RN BLE frame write errors fail the APDU instead of only logging.

### Medium Risk

1. Replace TypeScript framer object model with direct raw-frame encoder/decoder.
2. Preallocate response buffer in `DefaultApduReceiverService`.
3. Optimize RN HID JS Base64 helpers.
4. Replace Kotlin `payload += rawApdu` with preallocated copy or `ByteArrayOutputStream`.

### Higher Risk / Larger Design

1. Add a transport-level bulk APDU mode that coalesces progress and session events.
2. Add a native BLE framed exchange method to reduce per-frame JS/native crossings.
3. Experiment with a small write-without-response window instead of strictly awaiting every frame.

## Suggested Priority Order

1. Profile with progress throttled and debug logging disabled.
2. Test Android BLE high connection priority.
3. Instrument BLE write loop vs response wait.
4. Fix RN BLE write error propagation.
5. Remove UUIDs and optimize TypeScript frame encode/decode.
6. Optimize RN HID Base64/framing/logging.
7. Consider native bulk/framed exchange if JS/native frame crossings dominate.

## Main Takeaway

Framing itself is unavoidable, but the current implementation can be made much cheaper. The most promising improvements are not protocol changes: they are reducing JS/native crossings, avoiding per-frame object churn, avoiding eager full-payload logs, throttling progress/state events, restoring Android BLE connection priority, and making error paths fail fast during bulk transfer.
