# React Native Bulk APDU Testing Protocol

## Goal

Find where Ledger Wallet loses performance during bulk APDU transfers with `device-management-kit`, especially app installs and OS update-like workloads that send hundreds or thousands of maximum-size APDUs.

This file is the running protocol and results log. After each test, paste the result into the matching section. Based on the result, we choose the next test.

## Rules For The Tests

Use the same phone, same Ledger device, same firmware/app, same app/APDU payload, same connection type, and same build type as much as possible.

Before each test, update `BULK_APDU_PERF_TEST_STEP` in `packages/device-management-kit/src/api/utils/BulkApduPerf.ts`. The final `[DMK_BULK_PERF]` log includes this value as `testStep`, so the raw logs prove which protocol step and conditions were being tested.

For every run, record:

- Date/time.
- Phone model and OS.
- Ledger device model and firmware.
- Connection type: RN BLE or RN HID.
- App/install payload used.
- Number of APDUs.
- Whether debug logs are enabled.
- Whether progress throttling is enabled.
- Whether Android BLE connection priority is high.
- Whether this is current transport or optimized transport.

Avoid per-frame or per-APDU `console.log` during measurement unless the test explicitly says to do that. Per-APDU logs can become the bottleneck. Prefer aggregate counters in memory and one `console.log` summary at the end.

## Test Order

1. Add aggregate timing around one full bulk exchange.
2. Run the baseline bulk exchange and collect summary timings.
3. Disable/throttle likely noisy layers one at a time:
   - debug/full APDU logs
   - progress emissions
   - session refresher/scanning
4. Test Android BLE high connection priority.
5. Microbenchmark old vs optimized framing.
6. Add/switch to an optimized RN BLE transport and compare full bulk duration.
7. Consider deeper native BLE or write-window experiments only if the earlier tests show JS overhead is not the main issue.

## Test 1: Baseline Aggregate Perf Instrumentation

### Purpose

This is the first test because it should immediately show whether the time is mostly spent in:

- bulk task overhead,
- progress emissions,
- DMK session/state machine overhead,
- RN BLE framing/Base64,
- BLE native writes,
- notification/response wait,
- response reassembly,
- or unexpected busy/reconnection paths.

### Measurement Window

Start measurement only when the bulk exchange starts:

- In `ConnectToSecureChannelTask`, inside the `InMessageQueryEnum.BULK` case, immediately before the APDU `for` loop.
- In `InstallLanguagePackageTask`, immediately before its APDU `for` loop if testing language pack flow.

Stop measurement when the bulk loop:

- completes successfully,
- returns because of unsubscribe,
- throws/errors,
- or notifies an error.

The first implementation can be quick and dirty. A global singleton is acceptable for this test, as long as it is disabled by default and only active during the bulk loop.

### Optimization Model

For sequential bulk APDUs, treat the transfer as a repeated cycle:

```text
previous APDU response completed
  -> app/DMK/session/framing overhead
  -> next APDU first BLE write starts
  -> BLE/native/device transfer and processing
  -> first response notification received
  -> response decode/reassembly
  -> APDU response completed
```

The main optimization question is:

> If we cannot materially compress the send-to-receive transport/device time, how much time is left between one receive and the next send/write?

That gap is the practical optimization ceiling for JS/DMK/RN-side improvements. In the best case, we want:

```text
receive completed -> next APDU write starts ~= 0ms
```

Use these metrics for that model:

- `startedAtMs` and `endedAtMs`: exact bulk measurement window; `totalMs = endedAtMs - startedAtMs`.
- `ble.writeLoopStartToFirstNotificationMs`: closest JS-side proxy for full "send started -> receive tick" time. This includes JS/native write promises, BLE transfer, device processing, and notification scheduling.
- `ble.lastWriteToFirstNotificationMs`: closest JS-side proxy for "after writes are queued/done -> receive tick" time. This is the least compressible part from JS.
- `ble.lastWriteToResponseMs`: same wait extended until APDU response reassembly completes.
- `ble.responseToNextApduStartMs`: overhead between APDU response completion and the next `RNBleApduSender.sendApdu` entering.
- `ble.responseToNextWriteStartMs`: overhead between APDU response completion and the next first BLE write starting. This includes next-APDU framing/Base64 setup and is the best "how much could we win outside transfer speed?" metric.

Derived values to compute after each run:

```text
interExchangeGapMs = durations["ble.responseToNextWriteStartMs"]
interExchangeGapPctOfTotal = interExchangeGapMs / totalMs
avgInterExchangeGapMs =
  interExchangeGapMs / counters["ble.responseToNextWriteStartSamples"]

sendToReceiveMs = durations["ble.writeLoopStartToFirstNotificationMs"]
sendToReceivePctOfTotal = sendToReceiveMs / totalMs

postWriteReceiveMs = durations["ble.lastWriteToFirstNotificationMs"]
postWriteReceivePctOfTotal = postWriteReceiveMs / totalMs

bestCaseTotalIfInterExchangeGapZero =
  totalMs - interExchangeGapMs
bestCaseWinPct =
  interExchangeGapMs / totalMs
```

If `bestCaseWinPct` is small, optimizing JS overhead between exchanges cannot significantly improve the full bulk duration. If it is large, focus on the code between response resolution and the next BLE write: progress emissions, session state dispatch, logging, XState transitions, APDU hex parsing, framing, Base64, and any React subscriber work.

### Suggested Quick-And-Dirty Perf Collector

Create a tiny collector somewhere temporary, for example in DMK internals or directly near the bulk task while experimenting.

```ts
type BulkPerfStats = {
  active: boolean;
  label: string;
  startedAt: number;
  endedAt?: number;
  apduCount: number;
  progressEventCount: number;
  errors: string[];
  counters: Record<string, number>;
  durations: Record<string, number>;
};

const bulkPerf: BulkPerfStats = {
  active: false,
  label: "",
  startedAt: 0,
  apduCount: 0,
  progressEventCount: 0,
  errors: [],
  counters: {},
  durations: {},
};

export function bulkPerfStart(label: string) {
  bulkPerf.active = true;
  bulkPerf.label = label;
  bulkPerf.startedAt = performance.now();
  bulkPerf.endedAt = undefined;
  bulkPerf.apduCount = 0;
  bulkPerf.progressEventCount = 0;
  bulkPerf.errors = [];
  bulkPerf.counters = {};
  bulkPerf.durations = {};
}

export function bulkPerfEnd(extra: Record<string, unknown> = {}) {
  if (!bulkPerf.active) return;
  bulkPerf.endedAt = performance.now();
  const totalMs = bulkPerf.endedAt - bulkPerf.startedAt;
  console.log("[DMK_BULK_PERF]", {
    label: bulkPerf.label,
    totalMs,
    apduCount: bulkPerf.apduCount,
    msPerApdu: bulkPerf.apduCount ? totalMs / bulkPerf.apduCount : null,
    progressEventCount: bulkPerf.progressEventCount,
    counters: bulkPerf.counters,
    durations: bulkPerf.durations,
    errors: bulkPerf.errors,
    ...extra,
  });
  bulkPerf.active = false;
}

export function bulkPerfCount(name: string, count = 1) {
  if (!bulkPerf.active) return;
  bulkPerf.counters[name] = (bulkPerf.counters[name] ?? 0) + count;
}

export function bulkPerfAddDuration(name: string, durationMs: number) {
  if (!bulkPerf.active) return;
  bulkPerf.durations[name] = (bulkPerf.durations[name] ?? 0) + durationMs;
}

export function bulkPerfMeasure<T>(name: string, fn: () => T): T {
  if (!bulkPerf.active) return fn();
  const start = performance.now();
  try {
    return fn();
  } finally {
    bulkPerfAddDuration(name, performance.now() - start);
  }
}

export async function bulkPerfMeasureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!bulkPerf.active) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    bulkPerfAddDuration(name, performance.now() - start);
  }
}
```

### Instrumentation Points

#### Bulk Task

In `ConnectToSecureChannelTask`:

- Start: right before `for (let i = 0, len = input.data.length; i < len; i++)`.
- Increment `apduCount` once per APDU attempted.
- Measure hex parsing.
- Measure `this._api.sendApdu(apdu)`.
- Increment `progressEventCount` around `subscriber.next`.
- Stop in success and error paths.

Suggested counters/durations:

- `bulk.hexToBufferMs`
- `bulk.sendApduMs`
- `bulk.responseValidationMs`
- `bulk.progressNextMs`
- `bulk.apduCount`
- `bulk.progressEventCount`

#### DeviceSession

In `DeviceSession._unsafeInternalSendApdu`:

- Measure total time around `_connectedDevice.sendApdu`.
- Count session state dispatches.

Suggested durations/counters:

- `session.connectedDeviceSendApduMs`
- `session.totalUnsafeSendApduMs`
- `session.stateDispatch.connected`
- `session.stateDispatch.locked`
- `session.stateDispatch.unknown`

For public raw `dmk.sendApdu` loops only, also measure `_internalSendApdu` queue wait and queue execution time. For device actions, this should not be the main path per APDU.

#### DeviceConnectionStateMachine

In `DeviceConnectionStateMachine.sendApdu`:

- Count calls.
- Count when `apduInProgress.isJust()` is true.
- Measure wait time if it waits for `previousSendApduPromise`.
- Count `AlreadySendingApduError`.
- Count reconnection state entries if easy.

Suggested durations/counters:

- `connection.sendApduCalls`
- `connection.busyWaitHits`
- `connection.busyWaitMs`
- `connection.xstateSendApduMs`
- `connection.reconnectionEntries`
- `connection.alreadySendingErrors`

The expected result in a healthy device-action bulk flow is:

- `busyWaitHits = 0`
- `reconnectionEntries = 0`
- `alreadySendingErrors = 0`

If any of those are non-zero, stop and investigate that before optimizing framing.

#### RN BLE Sender

In `RNBleApduSender.sendApdu`:

- Measure `getFrames`.
- Count frames.
- Measure `frame.getRawData`.
- Measure Base64 encode.
- Measure each write, but aggregate only.
- Measure write loop total.
- Measure total APDU time until response promise resolves.
- Count write errors.
- Log once per connection:
  - `device.mtu`
  - derived frame size
  - write characteristic UUID
  - `isWritableWithoutResponse`

Suggested durations/counters:

- `ble.getFramesMs`
- `ble.frameCount`
- `ble.getRawDataMs`
- `ble.base64EncodeMs`
- `ble.writeCalls`
- `ble.writeMs`
- `ble.writeLoopMs`
- `ble.apduTotalMs`
- `ble.responseToNextApduStartMs`
- `ble.responseToNextWriteStartMs`
- `ble.writeErrors`
- `ble.timeoutCount`

Also measure response wait:

- `ble.lastWriteToFirstNotificationMs`
- `ble.writeLoopStartToFirstNotificationMs`
- `ble.apduStartToFirstNotificationMs`
- `ble.lastWriteToResponseMs`

These split the BLE/APDU timeline into:

- `responseToNextApduStartMs`: app/DMK overhead between one APDU response completing and the next BLE sender call starting.
- `responseToNextWriteStartMs`: app/DMK/framing overhead between one APDU response completing and the next first write starting.
- `lastWriteToFirstNotificationMs`: closest JS-side proxy for "in air" wait after the last frame write promise resolves.
- `writeLoopStartToFirstNotificationMs`: total write-loop plus notification wait.
- `lastWriteToResponseMs`: previous metric, including notification decode and receiver handling until APDU completion.

The final log should also include `startedAtMs` and `endedAtMs` so we can verify the exact bulk measurement window in addition to `totalMs`.

#### RN BLE Receiver

In `RNBleApduSender.onMonitor` and `receiveApdu`:

- Measure Base64 decode.
- Count notification frames.
- Measure receiver `handleFrame`.
- Count completed APDU responses.

Suggested durations/counters:

- `ble.notificationCount`
- `ble.firstResponseNotificationCount`
- `ble.base64DecodeMs`
- `ble.receiverHandleFrameMs`
- `ble.completedResponses`

#### DMK Framer

In current framer:

- `DefaultApduSenderService.getFrames`
- `Frame.getRawData`
- `DefaultApduReceiverService.handleFrame`
- `DefaultApduReceiverService.concatFrames`

Suggested durations/counters:

- `framer.getFramesMs`
- `framer.getFrameAtIndexMs`
- `framer.getFrameHeaderFromMs`
- `framer.uuidMs`
- `framer.numberToByteArrayMs`
- `framer.apduSliceMs`
- `framer.frameDataAllocAndSetMs`
- `framer.frameObjectsCreated`
- `framer.frameHeaderObjectsCreated`
- `framer.getRawDataMs`
- `framer.frameHeaderGetRawDataMs`
- `framer.frameRawBytes`
- `framer.apduPayloadBytes`
- `framer.handleFrameMs`
- `framer.parseRawFrameMs`
- `framer.isCompleteMs`
- `framer.concatFramesMs`
- `framer.responseSliceMs`
- `framer.receivedFrameCount`
- `framer.completedResponseCount`
- `framer.maxFramesPerApdu`

For the first runtime test, `framer.getFramesMs`, `framer.getRawDataMs`, `framer.handleFrameMs`, `framer.concatFramesMs`, frame counts, and bytes are enough. If those numbers are visible in the total, add the finer-grained counters above.

For a framing-specific microbenchmark, use the full list. The goal is to separate:

- protocol work that is unavoidable,
- object/model overhead,
- UUID generation,
- byte slicing/copying,
- raw-frame assembly,
- response concatenation,
- and Base64, which is adjacent to framing but not part of the framing protocol itself.

### Framing-Specific Instrumentation Detail

The current sender path has several sub-costs hidden inside `getFrames`:

1. `getFrameAtIndex`
2. `getFrameHeaderFrom`
3. `uuid.v4()`
4. `FramerUtils.numberToByteArray`
5. APDU `slice`
6. `frameData` allocation and `set`
7. `Frame` and `FrameHeader` construction
8. Later `Frame.getRawData`
9. Later `FrameHeader.getRawData`

The current receiver path has these hidden sub-costs:

1. header parsing from raw notification bytes
2. `uuid.v4()`
3. `Frame` and `FrameHeader` construction
4. pushing to `_pendingFrames`
5. `isComplete` reducing all pending frames
6. `concatFrames` repeatedly copying arrays
7. final data/status slicing

If we add detailed instrumentation directly into private methods, keep it temporary and aggregate only. Do not log per frame.

Useful derived metrics:

- `avgFramesPerApdu = framer.frameObjectsCreated / bulk.apduCount`
- `avgFrameRawBytes = framer.frameRawBytes / framer.frameObjectsCreated`
- `framingPctOfTotal = framer.getFramesMs / totalMs`
- `reassemblyPctOfTotal = framer.handleFrameMs / totalMs`
- `rawFrameAssemblyPct = framer.getRawDataMs / totalMs`
- `serializationPct = (ble.base64EncodeMs + ble.base64DecodeMs) / totalMs`

Important: do not include Base64 time inside "framing" when interpreting results. Base64 is a React Native bridge serialization cost.

### Event Loop and Measurement Blind Spots

The aggregate JS timings will not fully explain:

- native BLE stack queueing inside `react-native-ble-plx`,
- OS/radio scheduling,
- native GATT throughput,
- React rendering caused after progress emissions,
- Hermes GC pauses,
- or native module bridge internals.

Add one lightweight JS event loop lag metric during the bulk window:

```ts
let lastTick = performance.now();
const interval = setInterval(() => {
  const now = performance.now();
  const lag = now - lastTick - 100;
  lastTick = now;
  if (bulkPerf.active && lag > 0) {
    bulkPerf.counters["eventLoop.lagSamples"] =
      (bulkPerf.counters["eventLoop.lagSamples"] ?? 0) + 1;
    bulkPerf.durations["eventLoop.totalLagMs"] =
      (bulkPerf.durations["eventLoop.totalLagMs"] ?? 0) + lag;
    bulkPerf.counters["eventLoop.maxLagMs"] = Math.max(
      bulkPerf.counters["eventLoop.maxLagMs"] ?? 0,
      lag,
    );
  }
}, 100);
```

This is not a replacement for Hermes profiling, but it can quickly show whether the JS thread is being blocked during bulk transfer.

Also keep in mind that timing `subscriber.next(...)` only measures synchronous subscriber work. React rendering triggered by that progress update can happen later and will not be fully captured there. If progress looks suspicious, validate with Hermes/React Native profiler and a progress-throttling A/B test.

#### RN HID, If Testing HID

JS side:

- `uint8ArrayToBase64`
- native module `sendApdu`
- `base64ToUint8Array`
- response mapping

Native side:

- Base64 decode.
- `FramerService.serialize`.
- USB transmit.
- USB receive.
- `FramerService.deserialize`.
- Base64 encode response.

Use native aggregate logs, not per-frame logs.

### Expected First Output Shape

One plain `console.log` at the end:

```text
[DMK_BULK_PERF] {
  testStep: "Test 1: Baseline aggregate perf instrumentation",
  label: "secure-channel-bulk-install",
  totalMs: 123456,
  apduCount: 1500,
  msPerApdu: 82.3,
  progressEventCount: 1500,
  counters: {
    "ble.frameCount": 4500,
    "ble.writeCalls": 4500,
    "connection.busyWaitHits": 0,
    "connection.reconnectionEntries": 0
  },
  durations: {
    "bulk.sendApduMs": 118000,
    "session.connectedDeviceSendApduMs": 116500,
    "ble.getFramesMs": 700,
    "ble.base64EncodeMs": 1200,
    "ble.writeLoopMs": 70000,
    "ble.lastWriteToResponseMs": 42000,
    "ble.receiverHandleFrameMs": 400
  },
  errors: []
}
```

### Results

Paste raw result here after the first run.

```text
Run 1 - XRP app install over RN BLE

testStep: Test 1: Baseline aggregate perf instrumentation
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 31899.17599
msPerApdu: 116.42035
errors: []

Key counters:
- ble.isWritableWithoutResponse: 1
- ble.deviceMtu: 156
- ble.frameCount: 541
- ble.writeCalls: 541
- ble.notificationCount: 274
- ble.completedResponses: 274
- connection.sendApduCalls: 274
- session.stateDispatch.connected: 274
- eventLoop.lagSamples: 174
- eventLoop.maxLagMs: 101.093406

Key durations:
- bulk.sendApduMs: 23305.126792
- bulk.progressNextMs: 8484.68023
- bulk.hexToBufferMs: 83.357717
- session.totalUnsafeSendApduMs: 23295.14373
- session.connectedDeviceSendApduMs: 22507.553392
- connection.xstateSendApduMs: 661.25205
- ble.apduTotalMs: 22256.500292
- ble.writeLoopMs: 9804.899675
- ble.writeMs: 9716.153727
- ble.lastWriteToResponseMs: 11694.885433
- ble.getFramesMs: 369.182328
- ble.receiverHandleFrameMs: 228.637208
- ble.base64EncodeMs: 12.920674
- ble.base64DecodeMs: 18.980943
- framer.getFramesMs: 365.225965
- framer.handleFrameMs: 224.825223
- framer.uuidMs: 356.407666
- eventLoop.totalLagMs: 4462.320967

Derived:
- avgFramesPerApdu: 1.97 BLE write frames/APDU
- writeLoopPctOfTotal: 30.74%
- lastWriteToResponsePctOfTotal: 36.66%
- progressNextPctOfTotal: 26.60%
- sendApduPctOfTotal: 73.06%
- framingPctOfTotal: 1.14% sender getFrames only
- reassemblyPctOfTotal: 0.70%
- base64PctOfTotal: 0.10%
- xstateSendPctOfTotal: 2.07%
```

Interpretation:

- No busy-wait or reconnection counters were reported, so the reconnection path is not the issue in this run.
- `writeWithoutResponse` is confirmed active.
- The largest actionable gap is `bulk.progressNextMs`: ~8.5s, almost exactly the difference between `bulk.sendApduMs` and total runtime. This means synchronous progress subscribers/XState/UI propagation are a major contributor.
- BLE transport/device time is still the real baseline floor: write loop plus last-write-to-response is ~21.5s.
- Framing is visible but not first priority for end-to-end runtime: sender framing plus receiver handling is ~590ms total, far below progress and BLE transport time.
- `framer.uuidMs` is large relative to framing, so removing UUIDs is still a good cleanup, but it will not explain the 31.9s total.
- Event-loop lag is significant (`totalLagMs` ~4.46s, max ~101ms), consistent with JS-side pressure during the bulk run.

Decision:

- Next test should be Test 3 before logging, framing, or connection priority: run the same XRP install with progress emissions disabled or throttled to isolate `subscriber.next`/UI/XState cost.
- Keep the same aggregate instrumentation enabled.
- Expected result if progress is the culprit: `bulk.progressNextMs` should collapse and total time should move closer to `bulk.sendApduMs` (~23s), with lower event-loop lag.

### How To Interpret Test 1

If `connection.busyWaitHits > 0`:

- Investigate overlapping APDU calls or stuck transport promise first.
- Do not optimize framing yet.

If `connection.reconnectionEntries > 0`:

- Investigate BLE disconnect/reconnect behavior first.
- Capture disconnect errors and timestamps.

If `ble.writeLoopMs` dominates:

- Transport/native BLE throughput is the primary suspect.
- Next tests:
  - confirm `writeWithoutResponse`
  - test Android high connection priority
  - compare legacy/current transport write timings
  - consider native framed exchange later

If `ble.lastWriteToResponseMs` dominates:

- Device processing or notification path is the primary suspect.
- Next tests:
  - compare same APDU batch over HID
  - check notification decode/reassembly
  - check device/firmware-specific behavior

If `ble.responseToNextWriteStartMs` is large:

- JS/app overhead between exchanges is still compressible.
- This is the clearest measurement for the maximum win available outside raw transfer speed.
- Next tests:
  - remove or throttle progress emissions,
  - disable eager APDU logging,
  - reduce session state dispatch work,
  - optimize framing/Base64 setup,
  - profile the JS thread between APDU response completion and next write start.

If `ble.getFramesMs`, `ble.base64EncodeMs`, `framer.*`, or receiver timings are large:

- Framing/serialization optimization is likely relevant.
- Next test:
  - run old vs optimized framer microbenchmark.

If total time is high but measured transport time is not:

- The missing cost is likely progress events, XState snapshots, React rendering, logging, or uninstrumented code.
- Next tests:
  - throttle progress
  - disable logs
  - profile Hermes

If `progressEventCount` equals `apduCount` and UI feels slow:

- Run progress-throttled A/B next.

## Test 2: Logging Off A/B

### Purpose

Determine whether full APDU logging and XState/debug logging are significant.

### Protocol

Run the exact same bulk workload twice:

1. Current logger configuration.
2. Debug/full APDU logs disabled or no logger subscribers.

Keep the aggregate perf collector enabled in both runs.

### Results

```text
TODO
```

### Decision

If total time or JS responsiveness improves materially, make APDU hex logging lazy and/or disable it during bulk transfer.

## Test 3: Progress Throttling A/B

### Purpose

Determine whether per-APDU progress emissions and React updates hurt the app.

### Protocol

Run the same bulk workload with:

1. progress emitted per APDU,
2. progress emitted every 100 ms,
3. progress emitted only when rounded visible progress changes by at least 1 percent.

### Results

```text
Run 2 - XRP app install over RN BLE, progress counted but not emitted

testStep: Test 3a: Progress disabled A/B
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 19702.481494
msPerApdu: 71.906867
errors: []

Key counters:
- ble.isWritableWithoutResponse: 1
- ble.deviceMtu: 156
- ble.frameCount: 541
- ble.writeCalls: 541
- ble.notificationCount: 274
- ble.completedResponses: 274
- connection.sendApduCalls: 274
- session.stateDispatch.connected: 274
- eventLoop.lagSamples: 160
- eventLoop.maxLagMs: 163.348568

Key durations:
- bulk.sendApduMs: 19524.693256
- bulk.progressNextMs: 2.008898
- bulk.hexToBufferMs: 142.799386
- session.totalUnsafeSendApduMs: 19504.711008
- session.connectedDeviceSendApduMs: 18393.745268
- connection.xstateSendApduMs: 939.936966
- ble.apduTotalMs: 18016.347002
- ble.writeLoopMs: 5017.731852
- ble.writeMs: 4875.428347
- ble.lastWriteToResponseMs: 12008.229805
- ble.getFramesMs: 487.353845
- ble.receiverHandleFrameMs: 238.613836
- ble.base64EncodeMs: 21.777618
- ble.base64DecodeMs: 22.859025
- framer.getFramesMs: 482.386133
- framer.handleFrameMs: 233.896169
- framer.uuidMs: 465.199164
- eventLoop.totalLagMs: 1957.661476

Derived:
- total improvement vs baseline: -12196.694496ms (-38.24%)
- msPerApdu improvement vs baseline: -44.513483ms/APDU
- progressNext improvement vs baseline: -8482.671332ms
- eventLoop.totalLagMs improvement vs baseline: -2504.659491ms
- writeLoop improvement vs baseline: -4787.167823ms
- lastWriteToResponse change vs baseline: +313.344372ms
- framing sender + receiver: ~716ms, ~3.64% of total
```

### Decision

Progress propagation is confirmed as a primary app-side bottleneck. Disabling progress emissions reduced total duration from ~31.9s to ~19.7s and reduced `bulk.progressNextMs` from ~8.5s to ~2ms. It also reduced total event-loop lag from ~4.46s to ~1.96s.

The next test should find a usable progress policy:

- Test 3b: emit progress only when visible progress changes by at least 1%.
- Keep `bulkPerfMarkProgress()` counting attempted progress points.
- Add a separate counter for emitted progress events, for example `bulk.progressEmittedCount`.
- Expected result: total should stay much closer to ~19.7s than ~31.9s while still giving the UI useful progress updates.

Recommendation:

- Treat progress throttling as a production recommendation already supported by the data.
- A reasonable default is to emit only when visible progress changes by at least 1%, and always emit the final 100%.
- We do not need to spend the next measurement slot on tuning the exact progress policy; continue investigating the remaining ~19.7s transport/runtime floor.

## Test 4: Android BLE High Connection Priority

### Purpose

Compare current RN BLE with high connection priority, because legacy LedgerJS RN BLE passed `connectionPriority: 1`.

### Protocol

On Android BLE only, run the same bulk workload with:

1. current connect options,
2. connect/request high connection priority.

Candidate implementation:

- Add `connectionPriority: 1` in `connectToDevice` options if supported by `react-native-ble-plx`.
- Or call `device.requestConnectionPriority(ConnectionPriority.High)` after connection if available.

### Results

```text
Run 3 - XRP app install over RN BLE, progress disabled, Android high connection priority requested

testStep: Test 4: Android BLE high connection priority
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 19986.143918
msPerApdu: 72.942131
errors: []

Key counters:
- ble.highConnectionPriorityRequested: 1
- ble.isWritableWithoutResponse: 1
- ble.writeWithoutResponseCalls: 541
- ble.writeWithResponseCalls: 0
- ble.deviceMtu: 156
- ble.frameCount: 541
- ble.writeCalls: 541
- ble.notificationCount: 274
- ble.completedResponses: 274
- connection.sendApduCalls: 274
- session.stateDispatch.connected: 274
- eventLoop.lagSamples: 169
- eventLoop.maxLagMs: 36.340638

Key durations:
- bulk.sendApduMs: 19801.352026
- bulk.progressNextMs: 2.039313
- session.totalUnsafeSendApduMs: 19787.163284
- session.connectedDeviceSendApduMs: 18566.772736
- connection.xstateSendApduMs: 989.197487
- ble.apduTotalMs: 18190.767028
- ble.writeLoopMs: 5100.753379
- ble.writeMs: 4948.159248
- ble.lastWriteToResponseMs: 12018.022663
- ble.getFramesMs: 528.344468
- ble.receiverHandleFrameMs: 261.219139
- framer.getFramesMs: 522.585833
- framer.handleFrameMs: 256.275332
- framer.uuidMs: 502.959324
- eventLoop.totalLagMs: 1773.419256

Derived vs Test 3a:
- total change: +283.662424ms (+1.44%)
- writeLoop change: +83.021527ms
- lastWriteToResponse change: +9.792858ms
- eventLoop.totalLagMs change: -184.24222ms
```

### Decision

High connection priority was requested and all 541 writes used `writeWithoutResponse`, but the total runtime is essentially unchanged versus Test 3a. This does not look like a meaningful win for this device/phone/run.

Keep the explicit write-mode counters because they are useful, but do not prioritize connection priority as the next optimization unless more devices show a different result.

## Test 5: Current vs Optimized Framer Microbenchmark

### Purpose

Determine whether TypeScript framing is meaningful relative to bulk APDU scale.

This does not prove end-to-end speedup by itself, but it tells us whether framing is worth optimizing.

### Protocol

Benchmark:

1. Current `DefaultApduSenderService.getFrames` + `Frame.getRawData`.
2. Current `DefaultApduReceiverService.handleFrame`.
3. Optimized direct raw-frame encoder.
4. Optimized preallocated receiver.

Use many APDUs to get stable numbers:

- 100,000 APDUs minimum.
- Prefer 1,000,000 APDUs if runtime is acceptable.
- Mix representative sizes:
  - small APDU,
  - max command APDU,
  - multi-frame response.

Collect:

- total ms,
- frames/sec,
- APDUs/sec,
- memory/GC if available,
- output equivalence.

### Results

```text
TODO
```

### Decision

If optimized framing is much faster but end-to-end bulk Test 1 shows framing is less than 1 percent of total time, keep it as cleanup but do not prioritize.

If optimized framing is much faster and framing/Base64/receiver time is visible in Test 1, build the optimized RN BLE experiment.

## Test 6: Optimized RN BLE Transport A/B

### Purpose

Compare current RN BLE transport against an experimental optimized variant in the mobile sample app.

### Candidate Optimizations

Start with low-risk changes:

- direct raw-frame encoder/decoder,
- no per-frame UUIDs,
- no eager APDU hex logs,
- aggregate perf stats,
- Android high connection priority,
- write error fails current APDU,
- optional progress throttling outside the transport.

Do not start with write pipelining unless write-loop time still dominates after the low-risk changes.

### Protocol

In the mobile sample app, switch between:

1. `RNBleTransportFactory`,
2. experimental `OptimizedRNBleTransportFactory`.

Use the same device, same app install, same APDU payload, same phone, same build.

### Results

```text
TODO
```

### Decision

If optimized transport improves total time materially:

- Split fixes into production-safe PRs:
  1. connection priority,
  2. logging/progress throttling,
  3. framer optimization,
  4. error handling.

If not:

- Focus on native BLE throughput, device processing, or React-side work.

## Result Log

### Run 1

```text
TODO
```

### Run 2

```text
TODO
```

### Run 3

```text
TODO
```

## Current Next Step

Tests 5a and 6a have been run. UUID removal and a small write window both helped, but the remaining visible JS-side opportunity is now the inter-exchange gap.

Run Test 6b: same XRP app install over RN BLE with `writeWithoutResponse` fire-and-forget scheduling.

Implementation:

- update `BULK_APDU_PERF_TEST_STEP` to `Test 6b: RN BLE fire-and-forget writeWithoutResponse`;
- keep progress disabled so the result remains comparable with the previous transport-focused runs;
- keep per-frame UUID generation disabled;
- keep Android high connection priority enabled;
- keep the write window of `2` from Test 6a;
- add cross-layer marks from RN BLE response completion through the next APDU write start.
- run with JS dev mode off; this also disables `DevToolsLogger`/`DevToolsDmkInspector` through the `__DEV__` guard in `DmkProvider`;
- disable APDU send/receive debug logs in `DeviceSession` and RN BLE while the bulk perf collector is active;
- when `writeWithoutResponse` is available, schedule all frame writes for an APDU without awaiting each write promise;
- attach asynchronous write error handlers so rejected write promises still fail the active APDU instead of hanging silently;
- report fire-and-forget counters:
  - `ble.writeFireAndForgetMode`,
  - `ble.fireAndForgetApduCount`,
  - `ble.writePromisesNotAwaited`,
  - `ble.writeAsyncErrors`,
  - `ble.fireAndForgetWriteSettledApduCount`;
- add `fine.*` timings for the next-APDU startup chain:
  - bulk iteration start and hex parsing,
  - bulk `sendApdu` call to `DeviceSession` entry,
  - session entry to connected-device call,
  - connected-device call to connection state machine entry,
  - XState send/action/transport call,
  - RN BLE entry to APDU start,
  - RN BLE frame generation to write-loop start,
  - write-loop start to first frame/native write call;
- report skipped counters:
  - `logs.sendSkipped`,
  - `logs.receiveSkipped`,
  - `logs.sessionSendSkipped`,
  - `logs.sessionReceiveSkipped`,
  - `logs.bleSendSkipped`,
  - `logs.bleReceiveSkipped`.

Expected result:

- New `breakdown.*` timings should split `ble.responseToNextWriteStartMs` into:
  - RN BLE response completion to connection-state-machine `.then`,
  - connection-state-machine response event/callback,
  - callback to `DeviceSession` resume,
  - session logging/state dispatch to return,
  - bulk loop continuation/validation/progress counting,
  - next APDU entry and first BLE write start.
- If one bucket dominates, test a targeted fast path for that bucket next.
- If the gap is spread thinly across many small async continuations, stop chasing JS micro-optimizations and move to native BLE/legacy transport A/B.
- Compare against Test 7c/Test 7b.1 to estimate production-like unthrottled progress overhead without JS dev mode.
- If progress is still expensive out of dev mode, progress throttling/coalescing remains a production recommendation; if not, the original progress result was mostly dev-tooling amplification.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2, debug APDU logs enabled, no `DevToolsLogger`:

```text
testStep: Test 7a.2: Log totals without DevToolsLogger
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 18852.105732
msPerApdu: 68.803306
errors: []

Key counters:
- ble.highConnectionPriorityRequested: 1
- ble.isWritableWithoutResponse: 1
- ble.writeWindowSize: 2
- ble.windowedApduCount: 274
- ble.writeWithoutResponseCalls: 541
- ble.writeCalls: 541
- ble.frameCount: 541
- ble.notificationCount: 274
- ble.completedResponses: 274
- logs.sendCalls: 548
- logs.receiveCalls: 548
- logs.sessionSendCalls: 274
- logs.sessionReceiveCalls: 274
- logs.bleSendCalls: 274
- logs.bleReceiveCalls: 274

Key durations:
- totalMs: 18852.105732
- bulk.sendApduMs: 18645.232484
- session.totalUnsafeSendApduMs: 18631.069295
- session.connectedDeviceSendApduMs: 17371.065591
- connection.xstateSendApduMs: 876.296648
- ble.apduTotalMs: 16976.825218
- ble.writeLoopMs: 4669.507283
- ble.lastWriteToFirstNotificationMs: 11437.240678
- ble.lastWriteToResponseMs: 11579.827416
- ble.writeLoopStartToFirstNotificationMs: 16106.747961
- ble.responseToNextApduStartMs: 2750.705125
- ble.responseToNextWriteStartMs: 2901.558148

Log totals:
- logs.sendTotalMs: 1424.471619
- logs.receiveTotalMs: 987.174645
- logs.bleSendTotalMs: 715.017996
- logs.bleReceiveTotalMs: 506.570569
- logs.sessionSendTotalMs: 699.953466
- logs.sessionReceiveTotalMs: 471.466772
- ble.formatSentLogMs: 181.453356
- ble.formatReceivedLogMs: 16.007558
- session.formatSendingLogMs: 160.095071
- session.formatReceivedLogMs: 11.69896

Breakdown durations:
- breakdown.bleResponseCompleteToResolverCallMs: 520.678377
- breakdown.bleResponseCompleteToConnectionThenMs: 583.492766
- breakdown.connectionThenToResponseCallbackMs: 116.39449
- breakdown.bleResponseCompleteToResponseCallbackMs: 699.887256
- breakdown.responseCallbackToSessionResumeMs: 116.226151
- breakdown.bleResponseCompleteToSessionResumeMs: 816.113407
- breakdown.sessionResumeToUnsafeReturnMs: 529.688388
- breakdown.unsafeReturnToBulkResumeMs: 17.02099
- breakdown.bulkResumeToIterationCompleteMs: 12.025156
- breakdown.bulkIterationEndToNextIterationStartMs: 5.545155
- breakdown.bulkIterationEndToSessionStartMs: 198.631434
- breakdown.bulkIterationEndToBleApduStartMs: 1077.206732
- breakdown.bulkIterationEndToBleWriteStartMs: 1226.404137
- breakdown.bleResponseCompleteToNextBleApduStartMs: 2450.58988
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 2598.09541

Derived:
- Total change vs Test 7a.1: +765.741013ms (+4.23%).
- Log total change vs Test 7a.1: +188.162196ms.
- `logs.sendTotalMs + logs.receiveTotalMs`: 2411.646264ms, ~12.79% of total.
- Formatting-only total: 369.254945ms.
- Derived logger/console overhead: ~2042.391319ms.
- `ble.responseToNextWriteStartMs` change vs Test 7a.1: +141.299793ms.
- Test 7b with APDU logs disabled remains much faster: -2268.142309ms vs this run.
```

Interpretation:

- Removing `DevToolsLogger` did not collapse the log cost in this setup. The run was actually slower than Test 7a.1.
- The large logging overhead is therefore not only Rozenite/DMK DevTools. JS dev mode + Chrome/remote debugging + regular logger/console handling is enough to make per-APDU debug logs very expensive.
- For production relevance, repeat the logging comparison with JS dev mode off or a release-like build. For developer/QA relevance, this confirms that full APDU debug logs can heavily distort bulk transfer timings.
- Recommendation remains: make full APDU debug logging lazy/gated, and disable or coalesce it during bulk transfers.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2, debug APDU logs enabled, JS dev mode off:

```text
testStep: Test 7a.3: Log totals with JS dev mode off
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 17142.468687
msPerApdu: 62.563754
errors: []

Key counters:
- ble.writeWindowSize: 2
- ble.writeCalls: 541
- ble.writeWithoutResponseCalls: 541
- logs.sendCalls: 548
- logs.receiveCalls: 548
- logs.sessionSendCalls: 274
- logs.sessionReceiveCalls: 274
- logs.bleSendCalls: 274
- logs.bleReceiveCalls: 274
- eventLoop.lagSamples: 152
- eventLoop.maxLagMs: 18.374647

Key durations:
- bulk.sendApduMs: 16915.421472
- session.totalUnsafeSendApduMs: 16901.170497
- session.connectedDeviceSendApduMs: 16495.584354
- connection.xstateSendApduMs: 890.704627
- ble.apduTotalMs: 16113.382532
- ble.writeLoopMs: 4678.397555
- ble.lastWriteToFirstNotificationMs: 10978.68068
- ble.writeLoopStartToFirstNotificationMs: 15657.078235
- ble.responseToNextWriteStartMs: 1674.64204
- breakdown.bleResponseCompleteToResolverCallMs: 90.245947
- breakdown.sessionResumeToUnsafeReturnMs: 127.190801
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 1338.145972
- eventLoop.totalLagMs: 1549.422552

Log totals:
- logs.sendTotalMs: 560.820054
- logs.receiveTotalMs: 158.900445
- logs.sessionSendTotalMs: 251.182898
- logs.sessionReceiveTotalMs: 72.861869
- logs.bleSendTotalMs: 301.154712
- logs.bleReceiveTotalMs: 78.569074
- session.formatSendingLogMs: 175.057152
- session.formatReceivedLogMs: 11.03412
- ble.formatSentLogMs: 207.147156
- ble.formatReceivedLogMs: 14.941149

Derived:
- Total change vs Test 7a.2 (JS dev + Chrome, no DevToolsLogger): -1709.637045ms (-9.07%).
- Total change vs Test 7a.1 (JS dev + Chrome + DevToolsLogger): -943.896032ms (-5.22%).
- Total change vs Test 7b (APDU logs disabled): +558.505264ms (+3.37%).
- `logs.sendTotalMs + logs.receiveTotalMs`: 719.7205ms, ~4.20% of total.
- Formatting-only total: 408.179578ms.
- Derived logger/console overhead: ~311.540922ms.
- Log total change vs Test 7a.2: -1691.925764ms.
- Log total change vs Test 7a.1: -1503.363568ms.
- `ble.responseToNextWriteStartMs` change vs Test 7a.2: -1226.916108ms.
- `ble.responseToNextWriteStartMs` change vs Test 7b: +391.039628ms.
```

Interpretation:

- Turning JS dev mode off collapses most of the logging overhead even with APDU logs enabled.
- Full APDU logs still cost ~720ms on this run, but the extreme 2.2-2.4s log path cost was primarily dev-mode/Chrome/debug-tooling amplification.
- The logs-disabled run is still faster by ~559ms, so lazy/gated logging remains a production-relevant optimization, just much smaller than in dev mode.
- For production-like recommendations, prioritize:
  - do not attach debug/devtools log subscribers during bulk perf tests,
  - lazy-gate full APDU formatting and logger dispatch,
  - coalesce or disable full APDU logs during bulk transfers.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2, debug APDU logs disabled, JS dev mode off:

```text
testStep: Test 7b.1: APDU logs disabled with JS dev mode off
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 17454.805905
msPerApdu: 63.703671
errors: []

Key counters:
- ble.writeWindowSize: 2
- ble.writeCalls: 541
- ble.writeWithoutResponseCalls: 541
- logs.sendSkipped: 548
- logs.receiveSkipped: 548
- logs.sessionSendSkipped: 274
- logs.sessionReceiveSkipped: 274
- logs.bleSendSkipped: 274
- logs.bleReceiveSkipped: 274
- eventLoop.lagSamples: 154
- eventLoop.maxLagMs: 38.875326

Key durations:
- bulk.sendApduMs: 17209.721235
- session.totalUnsafeSendApduMs: 17191.118492
- session.connectedDeviceSendApduMs: 17119.352591
- connection.xstateSendApduMs: 917.993686
- ble.apduTotalMs: 16718.86599
- ble.writeLoopMs: 5089.446914
- ble.lastWriteToFirstNotificationMs: 11258.281705
- ble.writeLoopStartToFirstNotificationMs: 16347.728619
- ble.responseToNextWriteStartMs: 1186.609025
- breakdown.bleResponseCompleteToResolverCallMs: 7.748854
- breakdown.sessionResumeToUnsafeReturnMs: 50.062604
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 958.242809
- eventLoop.totalLagMs: 1634.853259

Derived:
- Total change vs Test 7a.3 (logs enabled, JS dev mode off): +312.337218ms (+1.82%).
- `ble.responseToNextWriteStartMs` change vs Test 7a.3: -488.033015ms.
- `breakdown.bleResponseCompleteToResolverCallMs` change vs Test 7a.3: -82.497093ms.
- `breakdown.sessionResumeToUnsafeReturnMs` change vs Test 7a.3: -77.128197ms.
- `breakdown.bleResponseCompleteToNextBleWriteStartMs` change vs Test 7a.3: -379.903163ms.
- Total change vs Test 7b (logs disabled, JS dev mode on): +870.842482ms (+5.25%).
```

Interpretation:

- With JS dev mode off, disabling APDU logs clearly reduces the inter-exchange JS gap, but the end-to-end total did not improve in this single run. Total was ~312ms slower than the logs-enabled JS-dev-off run, likely due BLE/device/runtime variance dominating a sub-second JS win.
- The relevant JS-side signal is still visible:
  - response-to-next-write dropped from ~1675ms to ~1187ms,
  - response-complete-to-next-write dropped from ~1338ms to ~958ms,
  - response-complete-to-resolver dropped from ~90ms to ~8ms.
- Production-like APDU log optimization is therefore real but modest at this APDU count; expect a larger proportional effect on larger bulk runs or under dev tooling.
- The remaining dominant floor is still BLE/native/device timing: write-loop-start-to-first-notification is ~16.35s.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2, debug APDU logs disabled, JS dev mode off, fine next-start breakdown:

```text
testStep: Test 7c: Fine next-APDU startup breakdown
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 16616.577072
msPerApdu: 60.644442
errors: []

Key counters:
- ble.writeWindowSize: 2
- ble.writeCalls: 541
- ble.writeWithoutResponseCalls: 541
- logs.sendSkipped: 548
- logs.receiveSkipped: 548
- logs.sessionSendSkipped: 274
- logs.sessionReceiveSkipped: 274
- logs.bleSendSkipped: 274
- logs.bleReceiveSkipped: 274
- eventLoop.lagSamples: 138
- eventLoop.maxLagMs: 15.969595

Key durations:
- bulk.hexToBufferMs: 176.452628
- bulk.sendApduMs: 16388.27617
- session.totalUnsafeSendApduMs: 16375.486219
- session.connectedDeviceSendApduMs: 16306.349127
- connection.xstateSendApduMs: 891.239417
- ble.apduTotalMs: 15919.611222
- ble.getFramesMs: 131.350155
- ble.getRawDataMs: 47.63687
- ble.base64EncodeMs: 18.77589
- ble.writeLoopMs: 4620.328121
- ble.writeMs: 6766.261969
- ble.lastWriteToFirstNotificationMs: 10966.084997
- ble.writeLoopStartToFirstNotificationMs: 15586.413118
- ble.responseToNextWriteStartMs: 1259.062205
- breakdown.bulkIterationEndToBleWriteStartMs: 535.970587
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 886.315926
- breakdown.bleResponseCompleteToResolverCallMs: 11.607445
- breakdown.sessionResumeToUnsafeReturnMs: 49.487643
- eventLoop.totalLagMs: 1422.292505

Fine durations:
- fine.bulkIterationEndToSendApduCallMs: 195.787687
- fine.bulkIterationStartToHexParsedMs: 181.832306
- fine.bulkHexParsedToSendApduCallMs: 9.007513
- fine.bulkSendApduCallToSessionStartMs: 18.276972
- fine.sessionStartToConnectedDeviceCallMs: 5.825365
- fine.bulkSendApduCallToConnectedDeviceCallMs: 24.102337
- fine.connectedDeviceCallToConnectionSendApduStartMs: 11.317551
- fine.connectionSendApduStartToXstateSendStartMs: 5.129278
- fine.connectionXstateSendStartToActionStartMs: 121.598033
- fine.connectionActionStartToTransportCallStartMs: 4.303422
- fine.connectionTransportCallToBleEntryMs: 10.314544
- fine.bleEntryToApduStartMs: 11.654122
- fine.bleApduStartToGetFramesStartMs: 7.819321
- fine.bleGetFramesEndToWriteLoopStartMs: 2.059534
- fine.bleWriteLoopStartToFirstWriteFrameStartMs: 20.715683
- fine.bleWriteLoopStartToFirstNativeWriteCallMs: 68.356102
- fine.bleWriteFrameStartToNativeWriteCallMs: 83.894379
- fine.connectionXstateSendWallMs: 897.017326

Derived:
- Total change vs Test 7b.1: -838.228833ms (-4.80%), likely runtime/BLE variance plus added instrumentation differences.
- `breakdown.bleResponseCompleteToNextBleWriteStartMs`: 886.315926ms, ~5.33% of total.
- `breakdown.bulkIterationEndToBleWriteStartMs`: 535.970587ms, ~3.23% of total.
- Average response-complete-to-next-write gap: ~3.25ms/APDU over 273 gaps.
- Average bulk-iteration-end-to-next-write gap: ~1.96ms/APDU over 273 gaps.
- `fine.bulkIterationStartToHexParsedMs`: ~0.66ms/APDU.
- `fine.connectionXstateSendStartToActionStartMs`: ~0.44ms/APDU.
- `fine.bleWriteLoopStartToFirstNativeWriteCallMs`: ~0.25ms/APDU.
- `fine.connectionXstateSendWallMs` mostly overlaps with XState send/action/transport work and should not be added to the smaller fine buckets.
```

Interpretation:

- The remaining JS next-start gap is now sub-second and no longer has a single large smoking gun.
- The largest non-overlapping fine buckets are:
  - bulk loop start + hex parsing (~182ms total),
  - XState send to action start (~122ms total),
  - first BLE frame preparation before native write (~68ms total),
  - session/connection/RN BLE handoff pieces at ~5-24ms each.
- TypeScript frame generation, raw-data extraction, and Base64 are measurable but not dominant at this scale.
- The original framing suspicion is therefore not supported as the main bottleneck for this XRP workload after UUID removal.
- The remaining end-to-end floor is overwhelmingly BLE/native/device timing: write-loop-start-to-first-notification is ~15.6s.

Result - XRP app install over RN BLE, fire-and-forget `writeWithoutResponse`, progress disabled, APDU logs disabled, JS dev mode off:

```text
testStep: Test 6b: RN BLE fire-and-forget writeWithoutResponse
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 17018.4168
msPerApdu: 62.11101
errors: []

Key counters:
- ble.writeFireAndForgetMode: 1
- ble.fireAndForgetApduCount: 274
- ble.writePromisesNotAwaited: 541
- ble.writeAsyncErrors: 0
- ble.fireAndForgetWriteSettledApduCount: 274
- ble.writeWindowSize: 2
- ble.writeCalls: 541
- ble.writeWithoutResponseCalls: 541
- logs.sendSkipped: 548
- logs.receiveSkipped: 548
- eventLoop.lagSamples: 148
- eventLoop.maxLagMs: 31.917357

Key durations:
- bulk.progressNextMs: 1.924635
- bulk.sendApduMs: 16774.023444
- session.totalUnsafeSendApduMs: 16755.161772
- session.connectedDeviceSendApduMs: 16680.863159
- connection.xstateSendApduMs: 942.035397
- ble.apduTotalMs: 16269.781939
- ble.getFramesMs: 152.423916
- ble.getRawDataMs: 54.433816
- ble.base64EncodeMs: 18.904893
- ble.writeLoopMs: 650.549018
- ble.writeMs: 7173.528177
- ble.lastWriteToFirstNotificationMs: 15244.454698
- ble.writeLoopStartToFirstNotificationMs: 15895.003716
- ble.responseToNextWriteStartMs: 1190.148189
- breakdown.bulkIterationEndToBleWriteStartMs: 586.870518
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 963.163013
- breakdown.bleResponseCompleteToResolverCallMs: 7.51797
- breakdown.sessionResumeToUnsafeReturnMs: 47.415575
- eventLoop.totalLagMs: 1450.942454

Fine durations:
- fine.bulkIterationEndToSendApduCallMs: 211.157671
- fine.bulkIterationStartToHexParsedMs: 201.39393
- fine.connectionXstateSendStartToActionStartMs: 120.027973
- fine.bleWriteLoopStartToFirstNativeWriteCallMs: 63.635008
- fine.bleWriteFrameStartToNativeWriteCallMs: 88.188812
- fine.connectionXstateSendWallMs: 949.111903

Derived:
- Total change vs Test 7c (window 2, progress/logs disabled): +401.839728ms (+2.42%).
- Total change vs Test 7b.1 (window 2, no fine instrumentation): -436.389105ms (-2.50%), likely run variance.
- `ble.writeLoopMs` change vs Test 7c: -3969.779103ms.
- `ble.lastWriteToFirstNotificationMs` change vs Test 7c: +4278.369701ms.
- `ble.writeLoopStartToFirstNotificationMs` change vs Test 7c: +308.590598ms.
- No asynchronous write errors were recorded.
```

Interpretation:

- Fire-and-forget did not break this XRP Android BLE run: all `541` write promises eventually settled and no async write errors were recorded.
- It did not improve end-to-end time. It mostly moved wall-clock time out of `ble.writeLoopMs` and into `ble.lastWriteToFirstNotificationMs`.
- That suggests `react-native-ble-plx`, Android BLE, or the device is still applying backpressure/serialization internally.
- For this XRP workload, fire-and-forget is not better than the safer window-2 approach.
- It may still be worth testing on larger multi-frame APDUs, but it should not be a default production optimization without broader device validation.

Result - XRP app install over RN BLE, unthrottled progress enabled, APDU logs disabled, JS dev mode off:

```text
testStep: Test 1b: Unthrottled progress with JS dev mode off
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 22003.421359
msPerApdu: 80.304458
errors: []

Key counters:
- bulk.progressEventCount: 274
- ble.writeWindowSize: 2
- ble.writeCalls: 541
- ble.writeWithoutResponseCalls: 541
- logs.sendSkipped: 548
- logs.receiveSkipped: 548
- eventLoop.lagSamples: 142
- eventLoop.maxLagMs: 56.967255

Key durations:
- bulk.progressNextMs: 5518.061484
- bulk.responseValidationMs: 2.090115
- bulk.hexToBufferMs: 80.525591
- bulk.sendApduMs: 16367.24507
- session.totalUnsafeSendApduMs: 16358.953156
- session.connectedDeviceSendApduMs: 16308.110676
- connection.xstateSendApduMs: 527.750427
- ble.apduTotalMs: 16068.814778
- ble.writeLoopMs: 7402.92204
- ble.writeMs: 13147.641936
- ble.lastWriteToFirstNotificationMs: 8458.493401
- ble.writeLoopStartToFirstNotificationMs: 15861.415441
- ble.responseToNextWriteStartMs: 6380.041206
- breakdown.bulkResumeToIterationCompleteMs: 5526.559714
- breakdown.bulkIterationEndToBleWriteStartMs: 314.957274
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 6019.47861
- breakdown.bleResponseCompleteToResolverCallMs: 4.103222
- breakdown.sessionResumeToUnsafeReturnMs: 39.98192
- eventLoop.totalLagMs: 2795.118985

Fine durations:
- fine.bulkIterationEndToSendApduCallMs: 92.939439
- fine.bulkIterationStartToHexParsedMs: 83.880012
- fine.bulkHexParsedToSendApduCallMs: 2.573958
- fine.bulkSendApduCallToSessionStartMs: 15.230357
- fine.sessionStartToConnectedDeviceCallMs: 3.316575
- fine.connectionXstateSendStartToActionStartMs: 80.077819
- fine.connectionTransportCallToBleEntryMs: 10.997089
- fine.bleWriteLoopStartToFirstNativeWriteCallMs: 32.362291
- fine.connectionXstateSendWallMs: 531.033285

Derived:
- Total change vs Test 7c (progress disabled, JS dev mode off): +5386.844287ms (+32.42%).
- `bulk.progressNextMs`: 5518.061484ms, ~25.08% of total.
- `breakdown.bulkResumeToIterationCompleteMs`: 5526.559714ms, matching the progress path.
- `ble.responseToNextWriteStartMs` change vs Test 7c: +5120.979001ms.
- `breakdown.bleResponseCompleteToNextBleWriteStartMs` change vs Test 7c: +5133.162684ms.
- Average progress emission/subscriber cost: ~20.14ms/APDU.
```

Interpretation:

- This confirms unthrottled progress emissions are a major bottleneck even with JS dev mode off.
- The initial dev-mode baseline overstated some logging costs, but it did not invent the progress problem.
- The progress path alone adds ~5.4-5.5s on this 274-APDU XRP install, about 20ms/APDU.
- Progress throttling/coalescing is the highest-confidence production recommendation from these tests.
- Since secure-channel progress is rounded to two decimals, many adjacent events are likely redundant from a user-visible perspective.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2, debug APDU logs disabled:

```text
testStep: Test 7b: Bulk debug APDU logs disabled
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 16583.963423
msPerApdu: 60.525414
errors: []

Key counters:
- ble.highConnectionPriorityRequested: 1
- ble.isWritableWithoutResponse: 1
- ble.writeWindowSize: 2
- ble.windowedApduCount: 274
- ble.writeWithoutResponseCalls: 541
- ble.writeCalls: 541
- ble.frameCount: 541
- ble.notificationCount: 274
- ble.completedResponses: 274
- logs.sendSkipped: 548
- logs.receiveSkipped: 548
- logs.sessionSendSkipped: 274
- logs.sessionReceiveSkipped: 274
- logs.bleSendSkipped: 274
- logs.bleReceiveSkipped: 274

Key durations:
- bulk.sendApduMs: 16363.444757
- session.totalUnsafeSendApduMs: 16349.99611
- session.connectedDeviceSendApduMs: 16267.188807
- connection.xstateSendApduMs: 882.86984
- ble.apduTotalMs: 15860.737143
- ble.writeLoopMs: 4625.697659
- ble.lastWriteToFirstNotificationMs: 10875.527127
- ble.lastWriteToResponseMs: 11025.065314
- ble.writeLoopStartToFirstNotificationMs: 15501.224786
- ble.responseToNextApduStartMs: 1126.666366
- ble.responseToNextWriteStartMs: 1283.602412
- session.stateDispatchMs: 41.094803

Breakdown durations:
- breakdown.bleResponseCompleteToResolverCallMs: 8.44192
- breakdown.bleResponseCompleteToConnectionThenMs: 58.267658
- breakdown.connectionThenToResponseCallbackMs: 107.999139
- breakdown.bleResponseCompleteToResponseCallbackMs: 166.266797
- breakdown.responseCallbackToSessionResumeMs: 139.861356
- breakdown.bleResponseCompleteToSessionResumeMs: 306.128153
- breakdown.sessionResumeToUnsafeReturnMs: 57.985316
- breakdown.unsafeReturnToBulkResumeMs: 13.414583
- breakdown.bulkResumeToIterationCompleteMs: 16.350994
- breakdown.bulkIterationEndToNextIterationStartMs: 6.068804
- breakdown.bulkIterationEndToSessionStartMs: 209.651747
- breakdown.bulkIterationEndToBleApduStartMs: 384.135871
- breakdown.bulkIterationEndToBleWriteStartMs: 539.821725
- breakdown.bleResponseCompleteToNextBleApduStartMs: 779.667776
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 934.465196

Derived:
- Total change vs Test 7a.1: -1502.401296ms (-8.31%).
- Total change vs Test 7a: -1518.26588ms (-8.39%).
- Total change vs Test 6a: -1337.844612ms (-7.46%).
- `ble.responseToNextWriteStartMs` change vs Test 7a.1: -1476.655943ms (-53.50%).
- `breakdown.bleResponseCompleteToResolverCallMs` change vs Test 7a.1: -490.735746ms.
- `breakdown.sessionResumeToUnsafeReturnMs` change vs Test 7a.1: -428.726241ms.
- `breakdown.bulkIterationEndToBleWriteStartMs` change vs Test 7a.1: -593.192085ms.
- Remaining measured response-complete-to-next-write gap: 934.465196ms, ~5.63% of total.
```

Interpretation:

- This confirms the debug APDU log path was a major JS-side bottleneck.
- The biggest improvements line up exactly with the log paths:
  - RN BLE receive resolver path dropped from ~499ms to ~8ms.
  - Session post-processing dropped from ~487ms to ~58ms.
  - Next-APDU startup dropped from ~1133ms to ~540ms.
- The remaining JS inter-exchange gap is under 1s total for this XRP install.
- Production recommendation: make APDU debug logging lazy/gated and disable/coalesce full APDU send/receive logs during bulk transfers. Do not eagerly format or dispatch debug logs when no debug subscriber needs them.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2, response-to-next-send breakdown with log totals:

```text
testStep: Test 7a.1: Response-to-next-send breakdown with log totals
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 18086.364719
msPerApdu: 66.00863
errors: []

Key counters:
- ble.highConnectionPriorityRequested: 1
- ble.isWritableWithoutResponse: 1
- ble.writeWindowSize: 2
- ble.windowedApduCount: 274
- ble.writeWithoutResponseCalls: 541
- ble.writeCalls: 541
- ble.frameCount: 541
- ble.notificationCount: 274
- ble.completedResponses: 274
- logs.sendCalls: 548
- logs.receiveCalls: 548
- logs.sessionSendCalls: 274
- logs.sessionReceiveCalls: 274
- logs.bleSendCalls: 274
- logs.bleReceiveCalls: 274

Key durations:
- totalMs: 18086.364719
- bulk.sendApduMs: 17872.799837
- session.totalUnsafeSendApduMs: 17860.070744
- session.connectedDeviceSendApduMs: 16722.568598
- connection.xstateSendApduMs: 738.911696
- ble.apduTotalMs: 16369.158506
- ble.writeLoopMs: 4411.188566
- ble.lastWriteToFirstNotificationMs: 11155.370641
- ble.lastWriteToResponseMs: 11280.369292
- ble.writeLoopStartToFirstNotificationMs: 15566.559207
- ble.responseToNextApduStartMs: 2626.916473
- ble.responseToNextWriteStartMs: 2760.258355

Log totals:
- logs.sendTotalMs: 1300.694569
- logs.receiveTotalMs: 922.389499
- logs.bleSendTotalMs: 666.238381
- logs.bleReceiveTotalMs: 484.698588
- logs.sessionSendTotalMs: 625.165946
- logs.sessionReceiveTotalMs: 429.199678
- ble.formatSentLogMs: 167.127519
- ble.formatReceivedLogMs: 14.129789
- session.formatSendingLogMs: 138.221889
- session.formatReceivedLogMs: 10.300261

Breakdown durations:
- breakdown.bleResponseCompleteToResolverCallMs: 499.177666
- breakdown.bleResponseCompleteToConnectionThenMs: 549.48345
- breakdown.connectionThenToResponseCallbackMs: 96.110057
- breakdown.bleResponseCompleteToResponseCallbackMs: 645.593507
- breakdown.responseCallbackToSessionResumeMs: 102.993762
- breakdown.bleResponseCompleteToSessionResumeMs: 748.587269
- breakdown.sessionResumeToUnsafeReturnMs: 486.711557
- breakdown.unsafeReturnToBulkResumeMs: 14.316564
- breakdown.bulkResumeToIterationCompleteMs: 10.870631
- breakdown.bulkIterationEndToNextIterationStartMs: 5.407441
- breakdown.bulkIterationEndToSessionStartMs: 206.652318
- breakdown.bulkIterationEndToBleApduStartMs: 1001.267652
- breakdown.bulkIterationEndToBleWriteStartMs: 1133.01381
- breakdown.bleResponseCompleteToNextBleApduStartMs: 2259.039656
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 2388.895135

Derived:
- Total change vs Test 7a: -15.864584ms (-0.09%), essentially identical.
- Total log path time, non-additive due nested measurements: send + receive = 2223.084068ms.
- Log path percentage of total: ~12.29%.
- Formatting-only time is only ~329.78ms; most log-path time is inside logger dispatch/callback work around `logger.debug(...)`.
- Session log paths total ~1054.365624ms.
- BLE log paths total ~1150.936969ms.
```

Interpretation:

- Logging is much more expensive than the format-only metrics suggested.
- The APDU hex formatting itself is visible but not the whole story; the full logger path around `logger.debug(...)` costs ~2.22s total in this run.
- This overlaps with several response-to-next-send buckets, especially `bleResponseCompleteToResolverCallMs`, `sessionResumeToUnsafeReturnMs`, and next APDU session/BLE send setup.
- The next targeted test should skip debug send/receive log calls during active bulk while keeping all transport/framing behavior unchanged.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2, response-to-next-send breakdown:

```text
testStep: Test 7a: Response-to-next-send breakdown
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 18102.229303
msPerApdu: 66.06653
errors: []

Key counters:
- ble.highConnectionPriorityRequested: 1
- ble.isWritableWithoutResponse: 1
- ble.writeWindowSize: 2
- ble.windowedApduCount: 274
- ble.writeWithoutResponseCalls: 541
- ble.writeCalls: 541
- ble.frameCount: 541
- ble.notificationCount: 274
- ble.completedResponses: 274
- breakdown.bleResponseCompleteToNextBleApduStartSamples: 273
- breakdown.bleResponseCompleteToNextBleWriteStartSamples: 273

Key durations:
- bulk.sendApduMs: 17891.545382
- session.totalUnsafeSendApduMs: 17877.759751
- session.connectedDeviceSendApduMs: 16738.120619
- connection.xstateSendApduMs: 797.673617
- ble.apduTotalMs: 16346.263913
- ble.writeLoopMs: 4350.011008
- ble.lastWriteToFirstNotificationMs: 11155.444166
- ble.lastWriteToResponseMs: 11286.6769
- ble.writeLoopStartToFirstNotificationMs: 15505.455174
- ble.responseToNextApduStartMs: 2621.968658
- ble.responseToNextWriteStartMs: 2766.829342

Breakdown durations:
- breakdown.bleResponseCompleteToResolverCallMs: 512.147501
- breakdown.bleResponseCompleteToConnectionThenMs: 570.569584
- breakdown.connectionThenToResponseCallbackMs: 106.437987
- breakdown.bleResponseCompleteToResponseCallbackMs: 677.007572
- breakdown.responseCallbackToSessionResumeMs: 120.44011
- breakdown.bleResponseCompleteToSessionResumeMs: 797.447682
- breakdown.sessionResumeToUnsafeReturnMs: 481.6863
- breakdown.unsafeReturnToBulkResumeMs: 15.559797
- breakdown.bulkResumeToIterationCompleteMs: 15.266514
- breakdown.bulkIterationEndToNextIterationStartMs: 5.500416
- breakdown.bulkIterationEndToSessionStartMs: 199.963561
- breakdown.bulkIterationEndToBleApduStartMs: 1010.940772
- breakdown.bulkIterationEndToBleWriteStartMs: 1154.32006
- breakdown.bleResponseCompleteToNextBleApduStartMs: 2318.599346
- breakdown.bleResponseCompleteToNextBleWriteStartMs: 2460.097009

Derived:
- Total change vs Test 6a: +180.421268ms (+1.01%), likely instrumentation overhead/noise.
- `breakdown.bleResponseCompleteToNextBleWriteStartMs`: 2460.097009ms, ~13.59% of total.
- Average response-complete-to-next-write gap: ~9.01ms/APDU over 273 gaps.
- Response completion to session resume: 797.447682ms, ~32.4% of the measured gap.
- Session resume to unsafe return: 481.6863ms, ~19.6% of the measured gap.
- Bulk iteration complete to next write start: 1154.32006ms, ~46.9% of the measured gap.
- The old `ble.responseToNextWriteStartMs` is slightly higher than the new 273-sample breakdown; use the new breakdown fields for this step because they exclude the non-existent final next APDU.
```

Interpretation:

- The inter-exchange gap is real but distributed. There is no single giant XState wait or queue stall.
- The largest measured sub-buckets are response completion to resolver/connection callback, session resume to unsafe return, and iteration-complete to next BLE write start.
- `connectionThenToResponseCallbackMs` and `responseCallbackToSessionResumeMs` are visible but not dominant on their own.
- `sessionResumeToUnsafeReturnMs` is mostly post-transport session work: received APDU log formatting, logger call, and session state dispatch.
- `bulkIterationEndToBleWriteStartMs` includes the next APDU's hex parsing, session send start, session sending log formatting, connection XState send, RN BLE frame building, and Base64 preparation.
- A targeted "skip session logs/state dispatch during bulk" test is now the best JS-side experiment. It targets known work inside the gap without touching BLE ordering/backpressure.

Result - XRP app install over RN BLE, progress disabled, UUID generation removed, write window 2:

```text
testStep: Test 6a: RN BLE writeWithoutResponse window 2
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
totalMs: 17921.808035
msPerApdu: 65.408059
errors: []

Key counters:
- ble.highConnectionPriorityRequested: 1
- ble.isWritableWithoutResponse: 1
- ble.writeWindowSize: 2
- ble.windowedApduCount: 274
- ble.writeWindowBatches: 274
- ble.writeWithoutResponseCalls: 541
- ble.writeCalls: 541
- ble.frameCount: 541
- ble.notificationCount: 274
- ble.completedResponses: 274

Key durations:
- bulk.sendApduMs: 17708.272653
- session.totalUnsafeSendApduMs: 17695.520712
- session.connectedDeviceSendApduMs: 16580.127168
- connection.xstateSendApduMs: 733.93106
- ble.apduTotalMs: 16240.978694
- ble.writeLoopMs: 4381.13388
- ble.writeMs: 6501.915069
- ble.lastWriteToFirstNotificationMs: 11104.09521
- ble.lastWriteToResponseMs: 11222.816848
- ble.writeLoopStartToFirstNotificationMs: 15485.22909
- ble.responseToNextWriteStartMs: 2573.399052
- framer.getFramesMs: 123.306109
- framer.handleFrameMs: 75.646353
- eventLoop.totalLagMs: 1507.558515

Derived:
- Total change vs Test 5a: -904.32983ms (-4.80%)
- `ble.writeLoopMs` change vs Test 5a: -548.859208ms
- `ble.lastWriteToFirstNotificationMs` change vs Test 5a: -258.328052ms
- `ble.writeLoopStartToFirstNotificationMs` change vs Test 5a: -807.18726ms
- `interExchangeGapMs = ble.responseToNextWriteStartMs`: 2573.399052ms
- `interExchangeGapPctOfTotal`: 14.36%
- `sendToReceiveMs = ble.writeLoopStartToFirstNotificationMs`: 15485.22909ms
- `sendToReceivePctOfTotal`: 86.40%
```

Interpretation:

- Window 2 did not break this Android BLE setup: the run completed successfully with no errors and every write used `writeWithoutResponse`.
- The win is real but moderate: ~0.9s total, mostly visible in the write loop and send-to-first-notification timings.
- `ble.writeMs` is higher because windowed writes overlap promises; do not compare it directly to wall-clock write-loop time.
- The remaining dominant floor is still send/receive/native/device timing, not TypeScript framing.
- Keep windowed writes as an experimental branch only until tested on more devices/apps, because BLE write-without-response backpressure is platform/device sensitive.

Previous result - XRP app install over RN BLE, progress disabled, UUID generation removed:

```text
testStep: Test 5a: Framer UUID disabled
label: secure-channel-bulk
status: success
declaredApduCount: 274
apduCount: 274
progressEventCount: 274
startedAtMs: 150380051.894394
endedAtMs: 150398878.032259
totalMs: 18826.137865
msPerApdu: 68.708532
errors: []

Key counters:
- ble.highConnectionPriorityRequested: 1
- ble.isWritableWithoutResponse: 1
- ble.writeWithoutResponseCalls: 541
- ble.writeWithResponseCalls: 0
- ble.frameCount: 541
- ble.writeCalls: 541
- ble.notificationCount: 274
- ble.firstResponseNotificationCount: 274
- ble.completedResponses: 274
- ble.responseToNextApduStartSamples: 274
- ble.responseToNextWriteStartSamples: 274
- ble.lastWriteToResponseSamples: 274
- connection.sendApduCalls: 274
- eventLoop.lagSamples: 154
- eventLoop.maxLagMs: 44.360952

Key durations:
- bulk.sendApduMs: 18633.702164
- bulk.progressNextMs: 2.125055
- session.totalUnsafeSendApduMs: 18620.211333
- session.connectedDeviceSendApduMs: 17484.329148
- connection.xstateSendApduMs: 607.992671
- ble.apduTotalMs: 17128.090136
- ble.writeLoopMs: 4929.993088
- ble.writeMs: 4790.84663
- ble.lastWriteToFirstNotificationMs: 11362.423262
- ble.lastWriteToResponseMs: 11531.007817
- ble.writeLoopStartToFirstNotificationMs: 16292.41635
- ble.apduStartToFirstNotificationMs: 16441.509755
- ble.responseToNextApduStartMs: 2471.962331
- ble.responseToNextWriteStartMs: 2621.055736
- ble.getFramesMs: 141.613979
- ble.receiverHandleFrameMs: 128.998043
- framer.getFramesMs: 136.426626
- framer.handleFrameMs: 124.725007
- eventLoop.totalLagMs: 1577.045756

Derived:
- UUID cost removed: previous `framer.uuidMs` was ~503ms; now absent.
- Total change vs Test 4: -1160.006053ms (-5.80%)
- Total change vs Test 3a: -876.343629ms (-4.45%)
- `framer.getFramesMs` change vs Test 4: -386.159207ms
- `framer.handleFrameMs` change vs Test 4: -131.550325ms
- `connection.xstateSendApduMs` change vs Test 4: -381.204816ms
- `interExchangeGapMs = ble.responseToNextWriteStartMs`: 2621.055736ms
- `interExchangeGapPctOfTotal`: 13.92%
- `avgInterExchangeGapMs`: 9.57ms/APDU
- `responseToNextApduStartMs`: 2471.962331ms
- `avgResponseToNextApduStartMs`: 9.02ms/APDU
- `sendToReceiveMs = ble.writeLoopStartToFirstNotificationMs`: 16292.41635ms
- `sendToReceivePctOfTotal`: 86.54%
- `postWriteReceiveMs = ble.lastWriteToFirstNotificationMs`: 11362.423262ms
- `postWriteReceivePctOfTotal`: 60.35%
- `bestCaseTotalIfInterExchangeGapZero`: 16205.082129ms
- `bestCaseWinPct`: 13.92%
```

Interpretation:

- UUID removal is worth keeping: it removes pure overhead and coincides with a ~0.9-1.2s end-to-end improvement versus the progress-disabled baselines.
- The new optimization model says JS/DMK overhead between APDU response completion and next first BLE write is ~2.62s total, ~9.57ms/APDU, ~13.9% of the total runtime.
- That ~13.9% is the practical ceiling for optimizing the code between exchanges without changing BLE/native/device transfer behavior.
- The remaining dominant floor is send-to-first-notification (~16.29s) and post-write-to-first-notification (~11.36s). That is mostly BLE/native/device timing from the JS perspective.
- Framer sender + receiver is now ~261ms total, only ~1.39% of total. Direct raw-frame encoding may still be cleaner, but it cannot be a large end-to-end win unless it also reduces broader JS/GC pressure.
- Independently from UUID impact, use `ble.responseToNextWriteStartMs / totalMs` as the best-case percentage we could still win by making exchange-to-exchange JS overhead approach zero.

## Conclusion

The biggest initial suspicion was that TypeScript framing, XState, or reconnection machinery might dominate bulk APDU performance. The measurements do not support that for this XRP install workload.

The confirmed bottlenecks are mostly:

1. **Unthrottled progress propagation**

   - With JS dev mode off, APDU logs disabled, UUID removed, and write window 2, re-enabling unthrottled progress increased total time from `16616.58ms` to `22003.42ms`.
   - Cost: `+5386.84ms` (`+32.42%`) for `274` APDUs.
   - Direct measured progress path: `bulk.progressNextMs = 5518.06ms`, about `20.14ms/APDU`.
   - This is the clearest production-relevant JS-side optimization target.

2. **Full APDU debug logging**

   - In JS dev mode with Chrome/remote debugging, APDU log paths cost roughly `2.2-2.4s` and heavily distort transfer timing.
   - With JS dev mode off, APDU logs still cost about `719.72ms` for the XRP install, but disabling them did not reliably improve end-to-end total in a single run because BLE/device variance was larger than the remaining JS win.
   - Recommendation: make full APDU logging lazy/gated, and disable or coalesce it during bulk transfers. Do not eagerly format and dispatch full APDU logs when no debug subscriber needs them.

3. **BLE write scheduling**

   - A small `writeWithoutResponse` window of `2` did not break the tested Android BLE setup.
   - Test 6a improved total by about `904ms` (`~4.8%`) versus Test 5a.
   - This remains experimental because BLE write-without-response backpressure is platform/device sensitive. It needs broader device/app testing before production use.

4. **Framer UUID removal**

   - Removing per-frame UUID generation is worth keeping: it removes pure overhead and correlated with a `~0.9-1.2s` improvement in progress-disabled runs.
   - After UUID removal, TypeScript framer sender + receiver cost was only a few hundred milliseconds for this workload. Framing is not the dominant remaining bottleneck.

5. **Remaining JS next-APDU startup work**

   - With JS dev mode off, APDU logs disabled, progress disabled, UUID removed, and write window 2, the response-complete-to-next-write gap is under `1s` for this workload.
   - Fine-grained measurements show no single large remaining JS culprit:
     - bulk loop + hex parsing: `~182ms`,
     - XState send to action start: `~122ms`,
     - first BLE frame preparation before native write: `~68ms`,
     - session/connection/RN BLE handoffs: mostly `5-24ms` each.
   - These are not irrelevant, but optimizing them one by one is unlikely to produce a large end-to-end win for app installs of this size.

6. **BLE/native/device transfer floor**
   - The dominant remaining wall-clock time is still send-to-first-notification:
     - around `15.5-16.3s` in the optimized/progress-disabled runs.
   - This bucket includes JS/native write promises, native BLE scheduling, radio timing, device processing, and notification scheduling.
   - Further large gains likely require native BLE transport experiments, a native framed APDU exchange path, write/backpressure experiments, or comparison against the legacy transport under matched conditions.

### Top Candidates For Production Work

Recommended order:

1. **Throttle/coalesce bulk progress events.**

   - Highest-confidence win.
   - For secure-channel bulk, emit only when user-visible progress changes, every N APDUs, or every fixed interval such as `100ms`.
   - Because progress is rounded to two decimals in the current task, many adjacent events may not carry new user-visible information.

2. **Lazy-gate APDU debug logging.**

   - Avoid building APDU log strings unless a debug subscriber is active.
   - Avoid dispatching full APDU send/receive logs during bulk by default.
   - Keep error logs and aggregate perf summaries.

3. **Keep the UUID removal.**

   - It is pure wasted work in the current frame model because UUID is not serialized into raw frames.
   - Low risk and already measured as useful.

4. **Evaluate write window 2 across more devices/apps.**

   - It helped on this setup, but production safety depends on BLE stack/device backpressure behavior.
   - Keep strict fallback to sequential writes when `writeWithoutResponse` is unavailable.

5. **Prototype native-side bulk exchange for in-house/native transports.**

   - This is the largest remaining architecture-level candidate once progress and logs are controlled.
   - Instead of doing one RN bridge round trip per APDU, send the whole APDU list once to native, loop on native, and return one final bulk result.
   - Existing RN HID POCs suggest this can materially reduce bulk transfer time by removing per-APDU bridge serialization/deserialization and avoiding JS-thread gaps between APDUs.

6. **Move to native/legacy BLE A/B if we need bigger gains.**

   - The JS work left after progress/log/UUID improvements is not large enough to explain the remaining transfer time.
   - Compare current RN BLE against legacy LedgerJS or a native framed exchange under the same phone/device/app payload.

### Native-Order Bulk Exchange Optimization

The Confluence note `[DMK] Bulk exchange perf improvements` proposes a different order of execution for in-house transports with a native implementation, especially RN HID and potentially a future in-house RN BLE implementation.

Current TypeScript-driven bulk order:

1. JS sends one APDU to native.
2. Native sends that APDU to the device.
3. Native returns the APDU response to JS.
4. JS validates/progresses/schedules the next APDU.
5. Repeat hundreds or thousands of times.

Native-order bulk exchange:

1. JS sends the full APDU list to native once.
2. Native loops over the APDUs and exchanges them with the device.
3. Native stops on error or returns one final aggregate result to JS.

Why this can be faster:

- It removes `N` React Native bridge round trips and replaces them with one bridge call.
- It avoids per-APDU Base64/JSON/string serialization between JS and native.
- It avoids waiting for the JS thread between consecutive APDUs.
- It keeps native transport backpressure and device exchange sequencing local to the native side.

Existing RN HID POC numbers from the Confluence page:

- DMK playground, Bitcoin app bulk exchange:

  - TS bulk exchange: `30s`
  - native `bulkExchange`: `20s`
  - roughly `33%` reduction in bulk transfer duration.

- Ledger Live Mobile dev build, Bitcoin app install:

  - legacy: `49s` total install, `38s` bulk exchange
  - DMK no optimization: `51s` total install, `42s` bulk exchange
  - DMK native bulk optimization: `30s` total install, `20s` bulk exchange
  - about `38%` faster total install and `48%` faster bulk exchange versus legacy in that dev setup.

- Ledger Live Mobile staging/prod-like build:
  - app install legacy: `28s` total, `22s` bulk
  - app install with native bulk optimization: `24s` total, `18s` bulk
  - about `14%` faster total install and `19%` faster bulk exchange.
  - OS update transfer legacy: `62s`
  - OS update transfer with native bulk optimization: `50s`
  - about `19%` faster transfer.

How this relates to this RN BLE investigation:

- Our RN BLE measurements show that after progress/log/UUID cleanup, the remaining dominant floor is `writeLoopStartToFirstNotificationMs`, roughly `15.5-16.3s` for this XRP install.
- From JS, that bucket includes native write promise scheduling, BLE stack/radio timing, device processing, and notification scheduling.
- A native-order bulk exchange would not make the BLE radio or device process APDUs faster by itself, but it could remove JS-thread gaps, bridge traffic, and per-APDU JS/native scheduling around that floor.
- For RN HID, the Confluence POC already validates that this architecture can be a large win.
- For RN BLE, the same idea likely requires a larger in-house native BLE transport or native framed exchange API, because `react-native-ble-plx` currently exposes per-frame/per-write JS calls.

Production-readiness considerations:

- Add `bulkExchangeApdus` or equivalent to `TransportConnectedDevice` so all transports have a coherent API.
- Keep a default fallback that loops in TypeScript for transports without native bulk support.
- Define native error semantics: stop on first non-`0x9000` response, return the failing index/status/response, and preserve cancellation/abort behavior.
- Define progress semantics: native can emit throttled progress events or JS can derive coarse progress from native callbacks.
- Keep secure-channel/device-action behavior identical from the caller perspective.
- Treat native BLE separately from RN HID: BLE write-without-response backpressure and notification ordering need device/platform validation.

Priority:

- For RN HID and OS update/app install paths already using native transports, native-order bulk exchange is a top architecture-level candidate.
- For RN BLE, first validate whether a native BLE exchange implementation is feasible and compare it against current RN BLE under matched conditions.
- This is a bigger project than progress/log/framer cleanup, but it is the most plausible route to gains larger than the remaining JS micro-optimizations.

### Potential Ledger Wallet Mobile Gains

These numbers come from the mobile sample/XRP install setup and should be applied to Ledger Wallet Mobile with a pinch of salt. Ledger Wallet Mobile has different screens, subscribers, logging configuration, release/dev settings, and some flows may already throttle progress.

Important distinction:

- **Inline app install through DMK device actions**

  - Likely closest to the tested path.
  - If it uses the DMK secure-channel `BULK` loop and forwards every progress event without throttling, the progress overhead could be large.
  - Based on Test 1b, unthrottled progress cost was `~5.5s` for `274` APDUs on this setup.
  - Expected LWM gain from progress throttling could therefore be significant for inline app installs, especially for larger apps with more APDUs.

- **Ledger OS update / install paths with existing LWM progress throttling**
  - Some LWM app/OS update paths may already throttle or coalesce progress before it reaches React state updates.
  - For those paths, the `~5.5s` progress win from this protocol should not be applied directly.
  - If progress is already throttled, the remaining gains are more likely:
    - APDU log gating,
    - UUID/framer cleanup,
    - write window/native BLE experiments,
    - reducing BLE/native/device transfer time.

Approximate gain expectations:

- **If progress is currently unthrottled**

  - Progress throttling/coalescing is the biggest likely win.
  - On this XRP run: up to `~5.4-5.5s` for `274` APDUs, about `20ms/APDU`.
  - Larger APDU counts could scale this cost further, but actual LWM UI/subscriber behavior must be measured.

- **If progress is already throttled**

  - Do not expect the full progress win.
  - Production-like APDU log gating looked closer to a sub-second JS-side win on this workload, although dev-mode/debug-tooling makes it much larger.
  - UUID removal and write window 2 each produced modest but real improvements in this setup.

- **If the flow is BLE/device-bound**
  - Once progress and logs are controlled, the remaining floor is mostly BLE/native/device timing.
  - LWM should then focus on native BLE throughput, write scheduling/backpressure, or comparing current RN BLE against legacy/native framed exchange paths.

Recommended LWM validation:

1. Run the same aggregate perf output inside the real LWM path.
2. Add counters for attempted progress events vs actually emitted UI progress events.
3. Record whether progress is throttled before React state updates.
4. Compare:
   - inline app install,
   - app update/install flow,
   - OS update flow,
   - with JS dev mode off and debug log subscribers disabled.
5. Only apply the progress-throttling gain to paths where progress is actually unthrottled.

### Cross-Codebase Progress Throttling Strategy

The biggest production-relevant lever we found is progress throttling. Because Ledger Wallet Mobile already throttles progress on its legacy `createSocket` path but not on the DMK secure-channel path, the practical win depends on which path the user is on and how aggressively we throttle.

#### Existing LWM Throttling Locations

Three stacked `throttleTime(100)` operators sit on the legacy `createSocket`-based install/uninstall path in `ledger-live-common`:

1. **`libs/ledger-live-common/src/hw/installApp.ts`** - filters `bulk-progress` events from `createDeviceSocket` and applies `throttleTime(100)` (about `10` events/sec). Same pattern in `uninstallApp.ts`.
2. **`libs/ledger-live-common/src/apps/runner.ts`** - wraps the per-`appOp` exec output with another `throttleTime(100)`, plus a final `distinctUntilChanged()` on the global progress stream.
3. **`libs/ledger-live-common/src/apps/inlineAppInstall.ts`** - applies a third `throttleTime(100)` on the multi-app install pipeline.

These throttles only protect the legacy `transport.exchangeBulk(...)` flow. They do not sit on the DMK secure-channel observable, so any LWM screen consuming the DMK-based install path currently receives the raw per-APDU progress stream.

#### Why `1-2` Events/Sec Is Enough

The DMK `subscriber.next(...)` per APDU was measured at about `20ms` of synchronous downstream work in the sample app. In LWM the per-event cost is realistically larger because more subscribers are wired in.

The right way to think about per-event cost in LWM is:

> **One emitted progress event = one forced re-render of every subscribed component tree.**

`progress: number` always changes reference, so `React.memo` and shallow-equality selectors on a parent do not stop the re-render of anything keyed by progress. The cost of one such render depends on:

- how many components subscribe to that progress observable (manager screen, install runner UI, account list, app catalog, modal state, badges, etc.),
- how memoized children of those subscribers are,
- how heavy the subscribed component trees are (lists, charts, animations, icons, layout work),
- whether selectors use stable equality vs default `===`, which determines how far the cascade propagates,
- redux/zustand subscriber work, Sentry breadcrumbs, analytics, and other listeners hanging off the same observable.

Because of this, the per-event cost is highly variable and not knowable from outside LWM:

- A clean, well-memoized subscriber tree might cost `5-15ms` per render.
- A screen with a poorly-memoized list of installed apps, storage bar, currency icons, etc. can easily reach `50-150ms+` per render.
- Crucially, you would normally never notice such a slow render path, because you do not usually fire `~14` renders/sec at a complex tree for `20s` straight.

A defensible LWM per-event cost band for planning is therefore `30-100ms`, with the upper bound easily exceeded for some flows. At those costs, even `10` events/sec costs hundreds of ms to multiple seconds per second of install time. Dropping to `1-2` events/sec lets the UI render a smooth progress bar via animation between updates and drops the per-event CPU cost by roughly an order of magnitude.

This is also the strongest argument for **fixing it at the source** (DMK throttle + lower LWM throttle) rather than going screen by screen trying to optimize every subscriber: the source fix bounds the cost regardless of how well or badly any individual consumer is memoized, now or in the future.

#### Expected Impact On Single XRP-Sized App Install

For an XRP install (`~270` APDUs over `~20s`):

| Path & throttle                      | Events propagated | Cost @ `30ms`/evt | Cost @ `100ms`/evt |
| ------------------------------------ | ----------------- | ----------------- | ------------------ |
| **DMK path today** (no throttle)     | `~270`            | `~8s`             | `~27s`             |
| **LWM legacy path today** (`10`/sec) | `~200`            | `~6s`             | `~20s`             |
| Both throttled to `2`/sec            | `~40`             | `~1s`             | `~4s`              |
| Both throttled to `1`/sec            | `~20`             | `~0.6s`           | `~2s`              |

Combined with adding a DMK-side throttle and lowering LWM throttles from `10`/sec to `1`/sec:

- **DMK path users:** roughly `~30s` -> `~22-25s` per XRP install (`~5-15s` saved depending on per-event cost).
- **LWM legacy path users:** roughly `~30s` -> `~25-28s` per XRP install (`~3-5s` saved on top of the existing `10`/sec throttle).

#### Expected Impact On Larger Workloads

The throttle saving scales with install duration. For the same `30-100ms`/event band:

| Workload              | Approx APDUs   | Wall time today | At `10`/sec     | At `1`/sec       | Approx time saved |
| --------------------- | -------------- | --------------- | --------------- | ---------------- | ----------------- |
| Single app (XRP)      | `~270`         | `~30s`          | `~200` events   | `~20` events     | **`3-15s`**       |
| Multi-app install (5) | `~1,500`       | `~3 min`        | `~1,000` events | `~120` events    | **`20-90s`**      |
| Language pack         | `~3,000-5,000` | `~5-10 min`     | `~3,000` events | `~300` events    | **`80s-4min`**    |
| Full FW / OS update   | `~20,000+`     | `~10-30 min`    | `~10,000+` evts | `~1,000+` events | **several min**   |

For long operations the relative gain shrinks because the BLE/native/device floor dominates, but the absolute time saved grows, and the side benefits become very noticeable.

#### Side Benefits Not Captured In Total Time

- Lower event-loop lag during bulk transfer keeps unrelated UI animations smooth (the eventLoop max-lag samples in the sample app baseline reached `~163ms`, larger than a typical JS task budget).
- Less Sentry breadcrumb noise during installs.
- Lower CPU/battery/heat on the phone, particularly relevant on Android where BLE alone is already power-heavy.
- Reduced risk of UI jank stealing time from BLE notification handling on the JS thread.

#### Concrete Change Set

Two small PRs across the two codebases:

1. **DMK** - in `ConnectToSecureChannelTask` (and any other DMK device action that loops bulk APDUs), wrap `subscriber.next(...)` in a throttle that emits at most `1-2` events/sec, plus a guaranteed final `100%` emission. Equivalent options:
   - rxjs-style `throttleTime(500-1000)` around the progress emission,
   - emit only when rounded visible progress changes (e.g. every `1%`),
   - skip emission if less than `N` ms elapsed since the last emission.
2. **Ledger Wallet Mobile** - change the three `throttleTime(100)` calls to `throttleTime(500)` or `throttleTime(1000)` in:

   - `libs/ledger-live-common/src/hw/installApp.ts` (and `uninstallApp.ts`),
   - `libs/ledger-live-common/src/apps/runner.ts`,
   - `libs/ledger-live-common/src/apps/inlineAppInstall.ts`.

   Optionally collapse the three layers into one once the source emission rate is well-controlled.

#### Validation Step Before Promising A Specific Number

A single instrumented LWM XRP install on the DMK path tells us:

- the actual `bulk.progressNextMs` in production,
- whether LWM's per-event cost sits at the low (`30ms`) or high (`100ms`) end of the band,
- which install/update flows are on the DMK path vs the legacy `createSocket` path today.

That is enough to pin the realistic gain for a stakeholder commit before shipping the change set.
