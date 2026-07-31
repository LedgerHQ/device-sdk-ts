import { type ContextModule } from "@ledgerhq/context-module";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type SignTransactionDAInput } from "@api/app-binder/SignTransactionDeviceActionTypes";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";
import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";
import { SignTransactionDeviceActionFactory } from "./SignTransactionDeviceActionFactory";

const contextModuleStub = {
  getContexts: vi.fn(),
} as unknown as ContextModule;

const defaultInput: SignTransactionDAInput = {
  derivationPath: "44'/501'/0'/0'",
  transaction: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
  contextModule: contextModuleStub,
};

const mockLoggerFactory = vi.fn((_tag: string) => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
}));

describe("SignTransactionDeviceActionFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a SignTransactionDeviceAction from the input", () => {
    const deviceAction = SignTransactionDeviceActionFactory({
      input: defaultInput,
    });

    expect(deviceAction).toBeInstanceOf(SignTransactionDeviceAction);
  });

  it("should forward the input and inspect to the device action", () => {
    const deviceAction = SignTransactionDeviceActionFactory({
      input: defaultInput,
      inspect: true,
    });

    expect(deviceAction.input).toBe(defaultInput);
    expect(deviceAction.inspect).toBe(true);
  });

  it("should forward the loggerFactory so it is used instead of internalApi.loggerFactory", () => {
    const internalApi = makeDeviceActionInternalApiMock();
    const deviceAction = SignTransactionDeviceActionFactory({
      input: defaultInput,
      loggerFactory: mockLoggerFactory,
    });

    deviceAction.makeStateMachine(internalApi);

    expect(mockLoggerFactory).toHaveBeenCalledWith(
      "SignTransactionDeviceAction",
    );
  });

  it("should return a device action usable as an XState actor", () => {
    const internalApi = makeDeviceActionInternalApiMock();
    const deviceAction = SignTransactionDeviceActionFactory({
      input: defaultInput,
    });

    const stateMachine = deviceAction.makeStateMachine(internalApi);

    expect(stateMachine).toBeDefined();
    expect(typeof stateMachine.provide).toBe("function");
    expect(stateMachine.config).toBeDefined();
  });
});
