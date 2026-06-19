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

import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import {
  type GenericClearSignDAError,
  type GenericClearSignDAInput,
  type GenericClearSignDAIntermediateValue,
  type GenericClearSignDAOutput,
  GenericClearSignDeviceAction,
} from "./GenericClearSignDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const contextModuleStub = { getContexts: vi.fn() } as unknown as ContextModule;

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let buildMock: ReturnType<typeof vi.fn>;
let provideMock: ReturnType<typeof vi.fn>;
let promptUiDisplayMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    buildGenericClearSignContext: buildMock,
    provideGenericClearSignContext: provideMock,
    promptUiDisplay: promptUiDisplayMock,
  };
}

const input: GenericClearSignDAInput = {
  derivationPath: defaultDerivation,
  transaction: exampleTx,
  contextModule: contextModuleStub,
};

function run(
  onComplete: (
    states: DeviceActionState<
      GenericClearSignDAOutput,
      GenericClearSignDAError,
      GenericClearSignDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new GenericClearSignDeviceAction({ input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any);
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    GenericClearSignDAOutput,
    GenericClearSignDAError,
    GenericClearSignDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

describe("GenericClearSignDeviceAction", () => {
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
    promptUiDisplayMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: undefined }));
  });

  it("build (recognised) then provide then prompt approved then armed", () =>
    new Promise<void>((resolve, reject) => {
      run((states) => {
        try {
          expect(buildMock).toHaveBeenCalled();
          expect(provideMock).toHaveBeenCalled();
          expect(promptUiDisplayMock).toHaveBeenCalled();
          const last = states[states.length - 1]!;
          expect(last.status).toBe(DeviceActionStatus.Completed);
          expect(
            last.status === DeviceActionStatus.Completed && last.output,
          ).toBe("armed");
          resolve();
        } catch (e) {
          reject(e);
        }
      }, reject);
    }));

  it("build mode none then degraded (no provide, no prompt)", () =>
    new Promise<void>((resolve, reject) => {
      buildMock.mockResolvedValue({
        mode: "none",
        poolContexts: [],
        instructionInfoContexts: [],
      });
      run((states) => {
        try {
          expect(provideMock).not.toHaveBeenCalled();
          expect(promptUiDisplayMock).not.toHaveBeenCalled();
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

  it("provide fails then degraded", () =>
    new Promise<void>((resolve, reject) => {
      provideMock.mockRejectedValue(new Error("stream boom"));
      run((states) => {
        try {
          expect(promptUiDisplayMock).not.toHaveBeenCalled();
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

  it("prompt non-cancel error then degraded", () =>
    new Promise<void>((resolve, reject) => {
      promptUiDisplayMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6a80", message: "bad data" } as any),
          }),
        }),
      );
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

  it("prompt user cancel (6985) then error", () =>
    new Promise<void>((resolve, reject) => {
      promptUiDisplayMock.mockResolvedValue(
        CommandResultFactory({
          error: new SolanaAppCommandError({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ errorCode: "6985", message: "Canceled by user" } as any),
          }),
        }),
      );
      run((states) => {
        try {
          expect(states[states.length - 1]!.status).toBe(
            DeviceActionStatus.Error,
          );
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
