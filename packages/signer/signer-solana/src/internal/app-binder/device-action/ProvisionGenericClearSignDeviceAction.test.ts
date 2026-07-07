import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ProvisionGenericClearSignDAError,
  type ProvisionGenericClearSignDAInput,
  type ProvisionGenericClearSignDAIntermediateValue,
  type ProvisionGenericClearSignDAOutput,
} from "@api/app-binder/ProvisionGenericClearSignDeviceActionTypes";
import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { ProvisionGenericClearSignDeviceAction } from "./ProvisionGenericClearSignDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const contextModuleStub = { getContexts: vi.fn() } as unknown as ContextModule;

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let buildMock: ReturnType<typeof vi.fn>;
let provideMock: ReturnType<typeof vi.fn>;
let finalizeMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    buildGenericClearSignContext: buildMock,
    provideGenericClearSignContext: provideMock,
    finalizeGenericClearSign: finalizeMock,
  };
}

const input: ProvisionGenericClearSignDAInput = {
  derivationPath: defaultDerivation,
  transaction: exampleTx,
  contextModule: contextModuleStub,
};

function run(
  onComplete: (
    states: DeviceActionState<
      ProvisionGenericClearSignDAOutput,
      ProvisionGenericClearSignDAError,
      ProvisionGenericClearSignDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new ProvisionGenericClearSignDeviceAction({ input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any);
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    ProvisionGenericClearSignDAOutput,
    ProvisionGenericClearSignDAError,
    ProvisionGenericClearSignDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

describe("ProvisionGenericClearSignDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    apiMock.getDeviceSessionState.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.18.0" },
      deviceModelId: DeviceModelId.NANO_X,
      isSecureConnectionAllowed: true,
    });
    buildMock = vi.fn().mockResolvedValue({
      mode: "full",
      poolContexts: [],
      instructionInfoContexts: [],
    });
    provideMock = vi.fn().mockResolvedValue(undefined);
    finalizeMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: undefined }));
  });

  it("build (recognised) then provide then finalize then prepared", () =>
    new Promise<void>((resolve, reject) => {
      run((states) => {
        try {
          expect(buildMock).toHaveBeenCalled();
          expect(provideMock).toHaveBeenCalled();
          expect(finalizeMock).toHaveBeenCalled();
          const last = states[states.length - 1]!;
          expect(last.status).toBe(DeviceActionStatus.Completed);
          expect(
            last.status === DeviceActionStatus.Completed && last.output,
          ).toBe("prepared");
          resolve();
        } catch (e) {
          reject(e);
        }
      }, reject);
    }));

  it("build mode none then degraded (no provide, no finalize)", () =>
    new Promise<void>((resolve, reject) => {
      buildMock.mockResolvedValue({
        mode: "none",
        poolContexts: [],
        instructionInfoContexts: [],
      });
      run((states) => {
        try {
          expect(provideMock).not.toHaveBeenCalled();
          expect(finalizeMock).not.toHaveBeenCalled();
          const last = states[states.length - 1]!;
          expect(
            last.status === DeviceActionStatus.Completed && last.output,
          ).toBe("degraded");
          resolve();
        } catch (e) {
          reject(e);
        }
      }, reject);
    }));

  it("provide fails then degraded (no finalize)", () =>
    new Promise<void>((resolve, reject) => {
      provideMock.mockRejectedValue(new Error("stream boom"));
      run((states) => {
        try {
          expect(finalizeMock).not.toHaveBeenCalled();
          const last = states[states.length - 1]!;
          expect(
            last.status === DeviceActionStatus.Completed && last.output,
          ).toBe("degraded");
          resolve();
        } catch (e) {
          reject(e);
        }
      }, reject);
    }));

  it("finalize descriptor-validity error then degraded", () =>
    new Promise<void>((resolve, reject) => {
      finalizeMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6a80", message: "incomplete" } as any),
          }),
        }),
      );
      run((states) => {
        try {
          expect(finalizeMock).toHaveBeenCalled();
          const last = states[states.length - 1]!;
          expect(
            last.status === DeviceActionStatus.Completed && last.output,
          ).toBe("degraded");
          resolve();
        } catch (e) {
          reject(e);
        }
      }, reject);
    }));

  it("finalize throws then degraded", () =>
    new Promise<void>((resolve, reject) => {
      finalizeMock.mockRejectedValue(new Error("finalize boom"));
      run((states) => {
        try {
          const last = states[states.length - 1]!;
          expect(
            last.status === DeviceActionStatus.Completed && last.output,
          ).toBe("degraded");
          resolve();
        } catch (e) {
          reject(e);
        }
      }, reject);
    }));

  it("build throws then degraded", () =>
    new Promise<void>((resolve, reject) => {
      buildMock.mockRejectedValue(new Error("parse boom"));
      run((states) => {
        try {
          const last = states[states.length - 1]!;
          expect(
            last.status === DeviceActionStatus.Completed && last.output,
          ).toBe("degraded");
          resolve();
        } catch (e) {
          reject(e);
        }
      }, reject);
    }));
});
