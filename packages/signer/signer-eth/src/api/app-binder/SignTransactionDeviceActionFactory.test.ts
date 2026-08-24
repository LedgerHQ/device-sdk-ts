import { type ContextModule } from "@ledgerhq/context-module";
import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";
import { EthersTransactionMapperService } from "@internal/transaction/service/mapper/EthersTransactionMapperService";
import { TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { SignTransactionDeviceActionFactory } from "./SignTransactionDeviceActionFactory";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

vi.mock(
  "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction")
      >();
    const MockSignTransactionDeviceAction = vi
      .fn()
      .mockImplementation(
        (
          ...args: ConstructorParameters<
            typeof actual.SignTransactionDeviceAction
          >
        ) => new actual.SignTransactionDeviceAction(...args),
      );
    MockSignTransactionDeviceAction.prototype =
      actual.SignTransactionDeviceAction.prototype;
    return {
      ...actual,
      SignTransactionDeviceAction: MockSignTransactionDeviceAction,
    };
  },
);

const contextModuleStub = {
  getContexts: vi.fn(),
} as unknown as ContextModule;

const mockLoggerFactory = vi.fn(
  (_tag: string) =>
    ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      subscribers: [],
    }) as unknown as LoggerPublisherService,
);

describe("SignTransactionDeviceActionFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a SignTransactionDeviceAction from the given arguments", () => {
    const deviceAction = SignTransactionDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      transaction: new Uint8Array([0xde, 0xad]),
      contextModule: contextModuleStub,
    });

    expect(deviceAction).toBeInstanceOf(SignTransactionDeviceAction);
  });

  it("should wire mapper and parser internally (not required from caller)", () => {
    const deviceAction = SignTransactionDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      transaction: new Uint8Array([0xde, 0xad]),
      contextModule: contextModuleStub,
    });

    expect(deviceAction.input.mapper).toBeInstanceOf(
      EthersTransactionMapperService,
    );
    expect(deviceAction.input.parser).toBeInstanceOf(TransactionParserService);
  });

  it("should forward inspect to the device action", () => {
    const deviceAction = SignTransactionDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      transaction: new Uint8Array([0xde, 0xad]),
      contextModule: contextModuleStub,
      inspect: true,
    });

    expect(deviceAction.inspect).toBe(true);
  });

  it("should forward loggerFactory so it is used instead of internalApi.loggerFactory", () => {
    SignTransactionDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      transaction: new Uint8Array([0xde, 0xad]),
      contextModule: contextModuleStub,
      loggerFactory: mockLoggerFactory,
    });

    expect(vi.mocked(SignTransactionDeviceAction)).toHaveBeenCalledWith(
      expect.objectContaining({ loggerFactory: mockLoggerFactory }),
    );
  });

  it("should return a device action usable as an XState actor", () => {
    const internalApi = makeDeviceActionInternalApiMock();
    const deviceAction = SignTransactionDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      transaction: new Uint8Array([0xde, 0xad]),
      contextModule: contextModuleStub,
    });

    const stateMachine = (
      deviceAction as SignTransactionDeviceAction
    ).makeStateMachine(internalApi);

    expect(stateMachine).toBeDefined();
    expect(typeof stateMachine.provide).toBe("function");
    expect(stateMachine.config).toBeDefined();
  });
});
