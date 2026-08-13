import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ProvisionTransactionCheckDAError,
  type ProvisionTransactionCheckDAInput,
  type ProvisionTransactionCheckDAIntermediateValue,
} from "@api/app-binder/ProvisionTransactionCheckDeviceActionTypes";
import { signTransactionDAStateSteps } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { ProvisionTransactionCheckDeviceAction } from "./ProvisionTransactionCheckDeviceAction";

const defaultDerivation = "44'/501'/0'/0'";
const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

const contextModuleStub = { getContexts: vi.fn() } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeAppConfig(
  overrides: Partial<AppConfiguration> = {},
): AppConfiguration {
  return {
    blindSigningEnabled: true,
    pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
    version: "1.16.0",
    transactionChecksEnabled: false,
    transactionChecksOptIn: false,
    ...overrides,
  };
}

let apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>;
let optInMock: ReturnType<typeof vi.fn>;
let provideMock: ReturnType<typeof vi.fn>;

function extractDeps() {
  return {
    transactionCheckOptIn: optInMock,
    provideTransactionCheck: provideMock,
  };
}

function run(
  input: ProvisionTransactionCheckDAInput,
  onComplete: (
    states: DeviceActionState<
      void,
      ProvisionTransactionCheckDAError,
      ProvisionTransactionCheckDAIntermediateValue
    >[],
  ) => void,
  onError: (e: unknown) => void,
) {
  const action = new ProvisionTransactionCheckDeviceAction({ input });
  vi.spyOn(action, "extractDependencies").mockReturnValue(extractDeps() as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  const { observable } = action._execute(apiMock);
  const states: DeviceActionState<
    void,
    ProvisionTransactionCheckDAError,
    ProvisionTransactionCheckDAIntermediateValue
  >[] = [];
  observable.subscribe({
    next: (s) => states.push(s),
    error: onError,
    complete: () => onComplete(states),
  });
}

function stepSequence(
  states: DeviceActionState<
    void,
    ProvisionTransactionCheckDAError,
    ProvisionTransactionCheckDAIntermediateValue
  >[],
): string[] {
  const steps: string[] = [];
  for (const s of states) {
    if (s.status !== DeviceActionStatus.Pending) continue;
    const step = (s.intermediateValue as { step?: string }).step;
    if (step && steps[steps.length - 1] !== step) steps.push(step);
  }
  return steps;
}

const baseInput: ProvisionTransactionCheckDAInput = {
  derivationPath: defaultDerivation,
  transaction: exampleTx,
  contextModule: contextModuleStub,
  appConfig: makeAppConfig(),
};

describe("ProvisionTransactionCheckDeviceAction", () => {
  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
    optInMock = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: { enabled: true } }));
    provideMock = vi.fn().mockResolvedValue(undefined);
  });

  it("not opted-in: runs opt-in, then provide when enabled, then completes", () =>
    new Promise<void>((resolve, reject) => {
      run(
        baseInput, // transactionChecksEnabled: false, transactionChecksOptIn: false
        (states) => {
          try {
            expect(optInMock).toHaveBeenCalled();
            // opt-in returned enabled: true, so provide runs.
            expect(provideMock).toHaveBeenCalled();
            const steps = stepSequence(states);
            expect(steps).toContain(
              signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN,
            );
            expect(steps).toContain(
              signTransactionDAStateSteps.TRANSACTION_CHECKS_PROVIDE,
            );
            expect(
              steps.indexOf(
                signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN,
              ),
            ).toBeLessThan(
              steps.indexOf(
                signTransactionDAStateSteps.TRANSACTION_CHECKS_PROVIDE,
              ),
            );
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("not opted-in + opt-in returns disabled: skips provide", () =>
    new Promise<void>((resolve, reject) => {
      optInMock.mockResolvedValue(
        CommandResultFactory({ data: { enabled: false } }),
      );
      run(
        baseInput,
        (states) => {
          try {
            expect(optInMock).toHaveBeenCalled();
            expect(provideMock).not.toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("already enabled: skips opt-in, runs provide directly", () =>
    new Promise<void>((resolve, reject) => {
      run(
        {
          ...baseInput,
          appConfig: makeAppConfig({
            transactionChecksEnabled: true,
            transactionChecksOptIn: true,
          }),
        },
        (states) => {
          try {
            expect(optInMock).not.toHaveBeenCalled();
            expect(provideMock).toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("already opted-in but not enabled: skips both opt-in and provide", () =>
    new Promise<void>((resolve, reject) => {
      run(
        {
          ...baseInput,
          appConfig: makeAppConfig({
            transactionChecksEnabled: false,
            transactionChecksOptIn: true,
          }),
        },
        (states) => {
          try {
            expect(optInMock).not.toHaveBeenCalled();
            expect(provideMock).not.toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("opt-in throws: still completes without provide (best-effort)", () =>
    new Promise<void>((resolve, reject) => {
      optInMock.mockRejectedValue(new Error("transport error"));
      run(
        baseInput,
        (states) => {
          try {
            expect(optInMock).toHaveBeenCalled();
            expect(provideMock).not.toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));

  it("provide throws: still completes (best-effort)", () =>
    new Promise<void>((resolve, reject) => {
      provideMock.mockRejectedValue(new Error("provide error"));
      run(
        {
          ...baseInput,
          appConfig: makeAppConfig({
            transactionChecksEnabled: true,
            transactionChecksOptIn: true,
          }),
        },
        (states) => {
          try {
            expect(provideMock).toHaveBeenCalled();
            expect(states[states.length - 1]!.status).toBe(
              DeviceActionStatus.Completed,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        reject,
      );
    }));
});
