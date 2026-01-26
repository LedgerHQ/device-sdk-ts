/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  ClearSignContextType,
  type ContextModule,
  TransactionSubset,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  hexaStringToBuffer,
  InvalidStatusWordError,
  TransportDeviceModel,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";
import { Just } from "purify-ts";
import { lastValueFrom, Observable } from "rxjs";

import {
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  type SignTransactionDAState,
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Signature } from "@api/index";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { TransactionType } from "@api/model/TransactionType";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { executeUntilStep } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionUntilStep";
import { ContextWithSubContexts } from "@internal/app-binder/task/BuildFullContextsTask";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

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

describe("SignTransactionDeviceAction", () => {
  let observable: Observable<
    DeviceActionState<
      Signature,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue
    >
  >;
  const contextModuleMock = {
    getFieldContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
  };
  const mapperMock: TransactionMapperService = {
    mapTransactionToSubset: vi.fn(),
  } as unknown as TransactionMapperService;
  const parserMock: TransactionParserService = {
    extractValue: vi.fn(),
  } as unknown as TransactionParserService;
  const getAppConfigMock = vi.fn();
  const web3CheckOptInMock = vi.fn();
  const parseTransactionMock = vi.fn();
  const buildContextsMock = vi.fn();
  const provideContextsMock = vi.fn();
  const signTransactionMock = vi.fn();
  const getAddressMock = vi.fn();
  function extractDependenciesMock() {
    return {
      getAppConfig: getAppConfigMock,
      web3CheckOptIn: web3CheckOptInMock,
      parseTransaction: parseTransactionMock,
      buildContexts: buildContextsMock,
      provideContexts: provideContextsMock,
      signTransaction: signTransactionMock,
      getAddress: getAddressMock,
    };
  }
  const apiMock = makeDeviceActionInternalApiMock();
  const defaultOptions = {
    domain: "domain-name.eth",
  };
  const defaultTransaction: Uint8Array = hexaStringToBuffer(
    Transaction.from({
      chainId: 1n,
      nonce: 0,
      data: "0x",
    }).unsignedSerialized,
  )!;
  const defaultSubset: TransactionSubset = {
    chainId: 1,
    data: "0x",
    selector: "0x",
    to: "0x",
    value: 0n,
  };
  const defaultAddress = "0x8ceb23fd6bc0add59e62ac25578270cff1b9f619";

  function createAppConfig(
    version: string,
    web3ChecksEnabled: boolean,
    web3ChecksOptIn: boolean,
  ) {
    return {
      blindSigningEnabled: false,
      web3ChecksEnabled,
      web3ChecksOptIn,
      version,
    };
  }

  function setupAppConfig(
    version: string,
    web3ChecksEnabled: boolean,
    web3ChecksOptIn: boolean,
  ) {
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
    apiMock.getDeviceModel.mockReturnValueOnce({
      id: DeviceModelId.FLEX,
    } as unknown as TransportDeviceModel);
    getAppConfigMock.mockResolvedValue(
      CommandResultFactory({
        data: createAppConfig(version, web3ChecksEnabled, web3ChecksOptIn),
      }),
    );
  }

  const getStep = (s: Array<SignTransactionDAState>, index: number) => {
    if (s[index]?.status !== DeviceActionStatus.Pending) {
      throw new Error(
        `Step ${index} is not pending: ${JSON.stringify(s[index])}`,
      );
    }
    return s[index];
  };

  describe("Happy path", () => {
    describe("should sign a transaction", () => {
      const contexts: ContextWithSubContexts[] = [
        {
          context: {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "payload-1",
          },
          subcontextCallbacks: [],
        },
        {
          context: {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "payload-2",
          },
          subcontextCallbacks: [],
        },
      ];

      beforeEach(() => {
        vi.resetAllMocks();
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);
        getAddressMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { address: defaultAddress },
          }),
        );

        // Mock the dependencies to return some sample data
        parseTransactionMock.mockResolvedValueOnce({
          subset: defaultSubset,
          type: TransactionType.EIP1559,
        });
        buildContextsMock.mockResolvedValueOnce({
          clearSignContexts: contexts,
          clearSigningType: ClearSigningType.EIP7730,
        });
        provideContextsMock.mockResolvedValueOnce(Just(void 0));
        signTransactionMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
          }),
        );

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock as unknown as ContextModule,
            mapper: mapperMock,
            parser: parserMock,
          },
          loggerFactory: mockLoggerFactory,
        });
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        observable = deviceAction._execute(apiMock).observable;
      });

      it("should open the app", async () => {
        const { steps } = await executeUntilStep(0, observable);
        expect(getStep(steps, 0).intermediateValue.step).toBe(
          SignTransactionDAStep.OPEN_APP,
        );
      });

      it("should confirm open app", async () => {
        const { steps } = await executeUntilStep(1, observable);
        expect(
          getStep(steps, 1).intermediateValue.requiredUserInteraction,
        ).toBe(UserInteractionRequired.ConfirmOpenApp);
      });

      it("should get app config", async () => {
        const { steps } = await executeUntilStep(2, observable);
        expect(getStep(steps, 2).intermediateValue.step).toBe(
          SignTransactionDAStep.GET_APP_CONFIG,
        );
      });

      it("should prebuild context", async () => {
        const { steps } = await executeUntilStep(3, observable);
        expect(getStep(steps, 3).intermediateValue.step).toBe(
          SignTransactionDAStep.PARSE_TRANSACTION,
        );
        expect(parseTransactionMock).toHaveBeenCalledTimes(1);
        expect(parseTransactionMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            input: {
              mapper: mapperMock,
              transaction: defaultTransaction,
            },
          }),
        );
      });

      it("should get address", async () => {
        const { steps } = await executeUntilStep(4, observable);
        expect(getStep(steps, 4).intermediateValue.step).toBe(
          SignTransactionDAStep.GET_ADDRESS,
        );
      });

      it("should build context", async () => {
        const { steps } = await executeUntilStep(5, observable);
        expect(getStep(steps, 5).intermediateValue.step).toBe(
          SignTransactionDAStep.BUILD_CONTEXTS,
        );
        expect(buildContextsMock).toHaveBeenCalledTimes(1);
        expect(buildContextsMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            input: expect.objectContaining({
              contextModule: contextModuleMock,
              parser: parserMock,
              mapper: mapperMock,
              options: defaultOptions,
              subset: { ...defaultSubset, from: defaultAddress },
              transaction: defaultTransaction,
              appConfig: createAppConfig("1.15.0", false, false),
              derivationPath: "44'/60'/0'/0/0",
              deviceModelId: DeviceModelId.FLEX,
            }),
          }),
        );
      });

      it("should provide context", async () => {
        const { steps } = await executeUntilStep(6, observable);
        expect(getStep(steps, 6).intermediateValue.step).toBe(
          SignTransactionDAStep.PROVIDE_CONTEXTS,
        );
        expect(provideContextsMock).toHaveBeenCalledTimes(1);
        expect(provideContextsMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            input: expect.objectContaining({
              contexts: contexts,
              serializedTransaction: defaultTransaction,
              derivationPath: "44'/60'/0'/0/0",
            }),
          }),
        );
      });

      it("should sign transaction", async () => {
        const { steps } = await executeUntilStep(7, observable);
        expect(getStep(steps, 7).intermediateValue.step).toBe(
          SignTransactionDAStep.SIGN_TRANSACTION,
        );
        expect(signTransactionMock).toHaveBeenCalledTimes(1);
        expect(signTransactionMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            input: {
              derivationPath: "44'/60'/0'/0/0",
              serializedTransaction: defaultTransaction,
              chainId: 1,
              transactionType: TransactionType.EIP1559,
              clearSigningType: ClearSigningType.EIP7730,
            },
          }),
        );
      });

      it("should return the signature", async () => {
        const result = await lastValueFrom(observable);
        expect(result).toEqual({
          status: DeviceActionStatus.Completed,
          output: {
            v: 0x1c,
            r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
            s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
          },
        });
      });
    });

    describe("should skip open app", () => {
      beforeEach(() => {
        vi.resetAllMocks();
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);
        getAddressMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { address: defaultAddress },
          }),
        );

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: { ...defaultOptions, skipOpenApp: true },
            contextModule: contextModuleMock as unknown as ContextModule,
            mapper: mapperMock,
            parser: parserMock,
          },
          loggerFactory: mockLoggerFactory,
        });
        parseTransactionMock.mockResolvedValueOnce({
          subset: defaultSubset,
          type: TransactionType.EIP1559,
        });
        buildContextsMock.mockResolvedValueOnce({
          clearSignContexts: [],
          clearSignContextsOptional: [],
          clearSigningType: ClearSigningType.BASIC,
        });
        provideContextsMock.mockResolvedValueOnce(Just(void 0));
        signTransactionMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
          }),
        );

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        observable = deviceAction._execute(apiMock).observable;
      });

      it("should skip open app and get app config directly", async () => {
        const { steps } = await executeUntilStep(0, observable);

        expect(getStep(steps, 0).intermediateValue.step).toBe(
          SignTransactionDAStep.GET_APP_CONFIG,
        );
      });
    });

    describe("should opt in to web3 checks", () => {
      beforeEach(() => {
        vi.resetAllMocks();
        setupOpenAppDAMock();
        setupAppConfig("1.16.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock as unknown as ContextModule,
            mapper: mapperMock,
            parser: parserMock,
          },
          loggerFactory: mockLoggerFactory,
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        web3CheckOptInMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { enabled: true } }),
        );

        observable = deviceAction._execute(apiMock).observable;
      });

      it("should opt in to web3 checks if app config is supported and not already enabled", async () => {
        const { steps } = await executeUntilStep(4, observable);

        expect(getStep(steps, 3).intermediateValue.step).toBe(
          SignTransactionDAStep.WEB3_CHECKS_OPT_IN,
        );
        expect(web3CheckOptInMock).toHaveBeenCalledTimes(1);

        expect(getStep(steps, 4).intermediateValue.step).toBe(
          SignTransactionDAStep.WEB3_CHECKS_OPT_IN_RESULT,
        );
        // @ts-expect-error - result is not typed
        expect(getStep(steps, 4).intermediateValue.result).toBe(true);
      });
    });

    describe("should not opt in to web3 checks", () => {
      beforeEach(() => {
        vi.resetAllMocks();
        setupOpenAppDAMock();

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock as unknown as ContextModule,
            mapper: mapperMock,
            parser: parserMock,
          },
          loggerFactory: mockLoggerFactory,
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        observable = deviceAction._execute(apiMock).observable;
      });

      it("should not opt in to web3 checks if app config is not supported", async () => {
        setupAppConfig("1.15.0", false, false);
        await executeUntilStep(3, observable);
        expect(web3CheckOptInMock).not.toHaveBeenCalled();
      });

      it("should not opt in to web3 checks if already enabled", async () => {
        setupAppConfig("1.16.0", true, false);
        await executeUntilStep(3, observable);
        expect(web3CheckOptInMock).not.toHaveBeenCalled();
      });

      it("should not opt in to web3 checks if already opted out", async () => {
        setupAppConfig("1.16.0", false, true);
        await executeUntilStep(3, observable);
        expect(web3CheckOptInMock).not.toHaveBeenCalled();
      });
    });
  });

  describe("Error cases", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should return an error if the open app throw an error", async () => {
      // GIVEN
      setupOpenAppDAMock(new Error("Open app failed"));
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Open app failed"),
      });
    });

    it("should return an error if the get app config return an error", async () => {
      // GIVEN
      setupOpenAppDAMock();
      getAppConfigMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("Get app config failed"),
        }),
      );
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new InvalidStatusWordError("Get app config failed"),
      });
    });

    it("should return an error if the get app config throw an error", async () => {
      // GIVEN
      setupOpenAppDAMock();
      getAppConfigMock.mockRejectedValueOnce(
        new Error("Get app config failed"),
      );
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Get app config failed"),
      });
    });

    it("should ignore the web3checks result if the command fails", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.16.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      web3CheckOptInMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("web3 check opt in failed"),
        }),
      );
      parseTransactionMock.mockResolvedValueOnce({
        subset: defaultSubset,
        type: TransactionType.EIP1559,
      });
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: defaultAddress },
        }),
      );
      buildContextsMock.mockResolvedValueOnce({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.BASIC,
      });
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            v: 0x1c,
            r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
            s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
          },
        }),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Completed,
        output: {
          v: 0x1c,
          r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
          s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
        },
      });
    });

    it("should return an error if the parse transaction throw an error", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      parseTransactionMock.mockRejectedValueOnce(
        new Error("Parse transaction failed"),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Parse transaction failed"),
      });
    });

    it("should blind sign if the first sign transaction fails and the second sign transaction succeeds", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      parseTransactionMock.mockResolvedValueOnce({
        subset: defaultSubset,
        type: TransactionType.EIP1559,
      });
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: defaultAddress },
        }),
      );
      buildContextsMock.mockResolvedValueOnce({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.BASIC,
      });
      provideContextsMock.mockResolvedValueOnce(Just(void 0));
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("Sign transaction failed"),
        }),
      );
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            v: 0x1c,
            r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad789",
            s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
          },
        }),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Completed,
        output: {
          v: 0x1c,
          r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad789",
          s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
        },
      });
    });

    it("should blind sign if the first sign transaction throws an error and the second sign transaction succeeds", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      parseTransactionMock.mockResolvedValueOnce({
        subset: defaultSubset,
        type: TransactionType.EIP1559,
      });
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: defaultAddress },
        }),
      );
      buildContextsMock.mockResolvedValueOnce({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.EIP7730,
      });
      provideContextsMock.mockResolvedValueOnce(Just(void 0));
      signTransactionMock.mockRejectedValueOnce(
        new Error("Sign transaction failed"),
      );
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            v: 0x1c,
            r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad789",
            s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
          },
        }),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Completed,
        output: {
          v: 0x1c,
          r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad789",
          s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
        },
      });
      expect(signTransactionMock).toHaveBeenCalledTimes(2);
      expect(signTransactionMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            serializedTransaction: defaultTransaction,
            chainId: 1,
            transactionType: TransactionType.EIP1559,
            clearSigningType: ClearSigningType.EIP7730,
          },
        }),
      );
      expect(signTransactionMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            serializedTransaction: defaultTransaction,
            chainId: 1,
            transactionType: TransactionType.EIP1559,
            clearSigningType: ClearSigningType.BASIC, // fallback to basic
          },
        }),
      );
    });

    it("should return an error if the sign transaction return two times an error", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      parseTransactionMock.mockResolvedValueOnce({
        subset: defaultSubset,
        type: TransactionType.EIP1559,
      });
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: defaultAddress },
        }),
      );
      buildContextsMock.mockResolvedValueOnce({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.BASIC,
      });
      provideContextsMock.mockResolvedValueOnce(Just(void 0));
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("Sign transaction failed"),
        }),
      );
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("Blind sign transaction failed"),
        }),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new InvalidStatusWordError("Blind sign transaction failed"),
      });
    });

    it("should return an error if the blind sign transaction fallback throws an error", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      parseTransactionMock.mockResolvedValueOnce({
        subset: defaultSubset,
        type: TransactionType.EIP1559,
      });
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: defaultAddress },
        }),
      );
      buildContextsMock.mockResolvedValueOnce({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.BASIC,
      });
      provideContextsMock.mockResolvedValueOnce(Just(void 0));
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("Sign transaction failed"),
        }),
      );
      signTransactionMock.mockRejectedValueOnce(
        new Error("Blind sign transaction fallback failed"),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: new Error("Blind sign transaction fallback failed"),
      });
    });

    it("should return an error without trying blind sign fallback when user refuses transaction (error code 6985)", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      parseTransactionMock.mockResolvedValueOnce({
        subset: defaultSubset,
        type: TransactionType.EIP1559,
      });
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: defaultAddress },
        }),
      );
      buildContextsMock.mockResolvedValueOnce({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.BASIC,
      });
      provideContextsMock.mockResolvedValueOnce(Just(void 0));

      // Create an error with the user refusal error code
      const userRefusalError = new InvalidStatusWordError(
        "User refused transaction",
      );
      (
        userRefusalError as InvalidStatusWordError & { errorCode: string }
      ).errorCode = "6985";

      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: userRefusalError,
        }),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Error,
        error: userRefusalError,
      });
      // Verify that signTransaction was only called once (no blind sign fallback attempt)
      expect(signTransactionMock).toHaveBeenCalledTimes(1);
    });

    it("should try blind sign fallback when error is not user refusal (different error code)", async () => {
      setupOpenAppDAMock();
      setupAppConfig("1.15.0", false, false);
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          transaction: defaultTransaction,
          options: defaultOptions,
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock,
          parser: parserMock,
        },
        loggerFactory: mockLoggerFactory,
      });
      vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
        extractDependenciesMock(),
      );
      parseTransactionMock.mockResolvedValueOnce({
        subset: defaultSubset,
        type: TransactionType.EIP1559,
      });
      getAddressMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: defaultAddress },
        }),
      );
      buildContextsMock.mockResolvedValueOnce({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.EIP7730,
      });
      provideContextsMock.mockResolvedValueOnce(Just(void 0));

      // Create an error with a different error code (not user refusal)
      const otherError = new InvalidStatusWordError("Some other error");
      (otherError as InvalidStatusWordError & { errorCode: string }).errorCode =
        "6A80";

      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: otherError,
        }),
      );
      signTransactionMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: {
            v: 0x1c,
            r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad789",
            s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
          },
        }),
      );
      observable = deviceAction._execute(apiMock).observable;

      // WHEN
      const result = await lastValueFrom(observable);

      // THEN
      expect(result).toEqual({
        status: DeviceActionStatus.Completed,
        output: {
          v: 0x1c,
          r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad789",
          s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
        },
      });
      // Verify that signTransaction was called twice (first attempt + blind sign fallback)
      expect(signTransactionMock).toHaveBeenCalledTimes(2);
      expect(signTransactionMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            serializedTransaction: defaultTransaction,
            chainId: 1,
            transactionType: TransactionType.EIP1559,
            clearSigningType: ClearSigningType.EIP7730,
          },
        }),
      );
      expect(signTransactionMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            serializedTransaction: defaultTransaction,
            chainId: 1,
            transactionType: TransactionType.EIP1559,
            clearSigningType: ClearSigningType.BASIC, // fallback to basic
          },
        }),
      );
    });
  });
});
