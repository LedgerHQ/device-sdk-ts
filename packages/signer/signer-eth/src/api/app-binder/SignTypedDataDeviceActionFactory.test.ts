import { type ContextModule } from "@ledgerhq/context-module";
import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type TypedData } from "@api/model/TypedData";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { SignTypedDataDeviceAction } from "@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction";
import { EthersTransactionMapperService } from "@internal/transaction/service/mapper/EthersTransactionMapperService";
import { TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { DefaultTypedDataParserService } from "@internal/typed-data/service/DefaultTypedDataParserService";

import { SignTypedDataDeviceActionFactory } from "./SignTypedDataDeviceActionFactory";

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
  "@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("@internal/app-binder/device-action/SignTypedData/SignTypedDataDeviceAction")
    >();
    const MockSignTypedDataDeviceAction = vi
      .fn()
      .mockImplementation(
        (
          ...args: ConstructorParameters<typeof actual.SignTypedDataDeviceAction>
        ) => new actual.SignTypedDataDeviceAction(...args),
      );
    MockSignTypedDataDeviceAction.prototype =
      actual.SignTypedDataDeviceAction.prototype;
    return { ...actual, SignTypedDataDeviceAction: MockSignTypedDataDeviceAction };
  },
);

const contextModuleStub = {
  getContexts: vi.fn(),
} as unknown as ContextModule;

const typedDataStub: TypedData = {
  domain: { name: "Test" },
  types: { EIP712Domain: [{ name: "name", type: "string" }] },
  message: {},
  primaryType: "EIP712Domain",
};

const mockLoggerFactory = vi.fn((_tag: string) =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  }) as unknown as LoggerPublisherService,
);

describe("SignTypedDataDeviceActionFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a SignTypedDataDeviceAction from the given arguments", () => {
    const deviceAction = SignTypedDataDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      data: typedDataStub,
      contextModule: contextModuleStub,
      skipOpenApp: false,
    });

    expect(deviceAction).toBeInstanceOf(SignTypedDataDeviceAction);
  });

  it("should wire parser, transactionMapper, and transactionParser internally (not required from caller)", () => {
    const deviceAction = SignTypedDataDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      data: typedDataStub,
      contextModule: contextModuleStub,
      skipOpenApp: false,
    });

    expect(deviceAction.input.parser).toBeInstanceOf(DefaultTypedDataParserService);
    expect(deviceAction.input.transactionMapper).toBeInstanceOf(EthersTransactionMapperService);
    expect(deviceAction.input.transactionParser).toBeInstanceOf(TransactionParserService);
  });

  it("should forward inspect to the device action", () => {
    const deviceAction = SignTypedDataDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      data: typedDataStub,
      contextModule: contextModuleStub,
      skipOpenApp: false,
      inspect: true,
    });

    expect(deviceAction.inspect).toBe(true);
  });

  it("should forward loggerFactory so it is used instead of internalApi.loggerFactory", () => {
    SignTypedDataDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      data: typedDataStub,
      contextModule: contextModuleStub,
      skipOpenApp: false,
      loggerFactory: mockLoggerFactory,
    });

    expect(vi.mocked(SignTypedDataDeviceAction)).toHaveBeenCalledWith(
      expect.objectContaining({ loggerFactory: mockLoggerFactory }),
    );
  });

  it("should return a device action usable as an XState actor", () => {
    const internalApi = makeDeviceActionInternalApiMock();
    const deviceAction = SignTypedDataDeviceActionFactory({
      derivationPath: "44'/60'/0'/0/0",
      data: typedDataStub,
      contextModule: contextModuleStub,
      skipOpenApp: false,
    });

    const stateMachine = deviceAction.makeStateMachine(internalApi);

    expect(stateMachine).toBeDefined();
    expect(typeof stateMachine.provide).toBe("function");
    expect(stateMachine.config).toBeDefined();
  });
});
