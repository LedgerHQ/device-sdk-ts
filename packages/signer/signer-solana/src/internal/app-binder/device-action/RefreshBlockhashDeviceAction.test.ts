import {
  type DeviceActionState,
  DeviceActionStatus,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RefreshBlockhashDAError,
  type RefreshBlockhashDAInput,
  type RefreshBlockhashDAIntermediateValue,
  type RefreshBlockhashDAOutput,
} from "@api/app-binder/RefreshBlockhashDeviceActionTypes";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { RefreshBlockhashDeviceAction } from "./RefreshBlockhashDeviceAction";

const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const exampleBlockhash = new Uint8Array(32).fill(0xab);
const patchedTx = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const rpcUrl = "https://api.devnet.solana.com";

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let fetchBlockhashMock: ReturnType<typeof vi.fn>;
let patchBlockhashMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    fetchBlockhashFn: fetchBlockhashMock,
    patchBlockhashFn: patchBlockhashMock,
  };
}

function run(
  input: RefreshBlockhashDAInput,
  onComplete: (
    states: DeviceActionState<
      RefreshBlockhashDAOutput,
      RefreshBlockhashDAError,
      RefreshBlockhashDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new RefreshBlockhashDeviceAction({ input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any);
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    RefreshBlockhashDAOutput,
    RefreshBlockhashDAError,
    RefreshBlockhashDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

describe("RefreshBlockhashDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    fetchBlockhashMock = vi.fn().mockResolvedValue(exampleBlockhash);
    patchBlockhashMock = vi.fn().mockResolvedValue(patchedTx);
  });

  it("with a source: fetches then patches and outputs the patched tx", () =>
    new Promise<void>((resolve, reject) => {
      run(
        { transaction: exampleTx, rpcUrl },
        (states) => {
          try {
            expect(fetchBlockhashMock).toHaveBeenCalledTimes(1);
            expect(patchBlockhashMock).toHaveBeenCalledTimes(1);
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(patchedTx);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("no source: skips the refresh and outputs the original tx", () =>
    new Promise<void>((resolve, reject) => {
      run(
        { transaction: exampleTx },
        (states) => {
          try {
            expect(fetchBlockhashMock).not.toHaveBeenCalled();
            expect(patchBlockhashMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleTx);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("fetch failure: best-effort, outputs the original tx (no patch)", () =>
    new Promise<void>((resolve, reject) => {
      fetchBlockhashMock.mockRejectedValue(new Error("rpc down"));
      run(
        { transaction: exampleTx, rpcUrl },
        (states) => {
          try {
            expect(patchBlockhashMock).not.toHaveBeenCalled();
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleTx);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("patch failure: best-effort, outputs the original tx", () =>
    new Promise<void>((resolve, reject) => {
      patchBlockhashMock.mockRejectedValue(new Error("patch boom"));
      run(
        { transaction: exampleTx, rpcUrl },
        (states) => {
          try {
            expect(fetchBlockhashMock).toHaveBeenCalledTimes(1);
            const last = states[states.length - 1]!;
            expect(
              last.status === DeviceActionStatus.Completed && last.output,
            ).toStrictEqual(exampleTx);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("uses a custom fetchBlockhash callback when provided", () =>
    new Promise<void>((resolve, reject) => {
      run(
        { transaction: exampleTx, fetchBlockhash: vi.fn() },
        (states) => {
          try {
            // The source guard is satisfied by the callback alone.
            expect(fetchBlockhashMock).toHaveBeenCalledTimes(1);
            const last = states[states.length - 1]!;
            expect(last.status).toBe(DeviceActionStatus.Completed);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));
});
