/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  hexaStringToBuffer,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";
import { Just, Left } from "purify-ts";

import {
  type SignTransactionDAState,
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { TransactionType } from "@api/model/TransactionType";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

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
  const contextModuleMock: ContextModule = {
    getContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getWeb3Checks: vi.fn(),
    getSolanaContext: vi.fn(),
  };
  const mapperMock: TransactionMapperService = {
    mapTransactionToSubset: vi.fn(),
  } as unknown as TransactionMapperService;
  const parserMock: TransactionParserService = {
    extractValue: vi.fn(),
  } as unknown as TransactionParserService;
  const getAppConfigMock = vi.fn();
  const web3CheckOptInMock = vi.fn();
  const preBuildContextMock = vi.fn();
  const buildContextMock = vi.fn();
  const buildSubContextAndProvideMock = vi.fn();
  const signTransactionMock = vi.fn();
  function extractDependenciesMock() {
    return {
      getAppConfig: getAppConfigMock,
      web3CheckOptIn: web3CheckOptInMock,
      preBuildContext: preBuildContextMock,
      buildContext: buildContextMock,
      buildSubContextAndProvide: buildSubContextAndProvideMock,
      signTransaction: signTransactionMock,
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
    getAppConfigMock.mockResolvedValue(
      CommandResultFactory({
        data: createAppConfig(version, web3ChecksEnabled, web3ChecksOptIn),
      }),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Happy path", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: "token",
              payload: "payload-1",
            },
          ],
          clearSignContextsOptional: [],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 1,
          transactionType: TransactionType.LEGACY,
          clearSigningType: ClearSigningType.BASIC,
        });
        buildSubContextAndProvideMock.mockResolvedValueOnce(Just(void 0));
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

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
            status: DeviceActionStatus.Pending,
          },
          // Final state
          {
            output: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: () => {
            // Verify mocks calls parameters
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.15.0", false, false),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );

            expect(buildSubContextAndProvideMock).toHaveBeenCalledWith(
              expect.objectContaining({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                input: expect.objectContaining({
                  context: {
                    type: "token",
                    payload: "payload-1",
                  },
                  contextOptional: [],
                  transactionParser: parserMock,
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  contextModule: contextModuleMock,
                  chainId: 1,
                  derivationPath: "44'/60'/0'/0/0",
                }),
              }),
            );

            expect(signTransactionMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  derivationPath: "44'/60'/0'/0/0",
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  chainId: 1,
                  transactionType: TransactionType.LEGACY,
                  clearSigningType: ClearSigningType.BASIC,
                },
              }),
            );
            resolve();
          },
          onError: reject,
        });
      }));

    it("should be successful while skipping OpenApp", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: {
              ...defaultOptions,
              skipOpenApp: true,
            },
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: "token",
              payload: "payload-1",
            },
          ],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 1,
          transactionType: TransactionType.LEGACY,
          clearSigningType: ClearSigningType.BASIC,
        });
        buildSubContextAndProvideMock.mockResolvedValueOnce(Just(void 0));
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

        // Expected intermediate values for the following state sequence:
        //   Initial -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
            status: DeviceActionStatus.Pending,
          },
          // Final state
          {
            output: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: resolve,
          onError: reject,
        });
      }));

    it("should call external dependencies with the correct parameters with the generic parser", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: ClearSignContextType.TRANSACTION_INFO,
              payload: "payload-1",
            },
            {
              type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
              payload: "payload-2",
            },
          ],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 7,
          transactionType: TransactionType.EIP1559,
          clearSigningType: ClearSigningType.EIP7730,
          clearSignContextsOptional: [],
        });
        buildSubContextAndProvideMock.mockResolvedValueOnce(Just(void 0));
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

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> BuildContext -> ProvideGenericContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
            status: DeviceActionStatus.Pending,
          },
          // Final state
          {
            output: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            // Verify mocks calls parameters
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.15.0", false, false),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );

            expect(buildSubContextAndProvideMock).toHaveBeenCalledTimes(2);
            expect(buildSubContextAndProvideMock).toHaveBeenNthCalledWith(
              1,
              expect.objectContaining({
                input: {
                  chainId: 7,
                  context: {
                    type: ClearSignContextType.TRANSACTION_INFO,
                    payload: "payload-1",
                  },
                  contextModule: contextModuleMock,
                  derivationPath: "44'/60'/0'/0/0",
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  transactionParser: parserMock,
                  contextOptional: [],
                },
              }),
            );
            expect(buildSubContextAndProvideMock).toHaveBeenNthCalledWith(
              2,
              expect.objectContaining({
                input: {
                  chainId: 7,
                  context: {
                    type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
                    payload: "payload-2",
                  },
                  contextModule: contextModuleMock,
                  derivationPath: "44'/60'/0'/0/0",
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  transactionParser: parserMock,
                  contextOptional: [],
                },
              }),
            );
            expect(signTransactionMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  derivationPath: "44'/60'/0'/0/0",
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  chainId: 7,
                  transactionType: TransactionType.EIP1559,
                  clearSigningType: ClearSigningType.EIP7730,
                },
              }),
            );
            resolve();
          },
        });
      }));

    it("should fallback to blind signing if provideContext return an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: ClearSignContextType.TRANSACTION_INFO,
              payload: "payload-1",
            },
          ],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 1,
          transactionType: TransactionType.LEGACY,
          clearSigningType: ClearSigningType.EIP7730,
          clearSignContextsOptional: [],
        });
        buildSubContextAndProvideMock.mockResolvedValueOnce(
          Left(new Error("provideContext error")),
        );
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

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
            status: DeviceActionStatus.Pending,
          },
          // Final state
          {
            output: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            // Verify mocks calls parameters
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.15.0", false, false),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            expect(buildSubContextAndProvideMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  context: {
                    type: ClearSignContextType.TRANSACTION_INFO,
                    payload: "payload-1",
                  },
                  contextOptional: [],
                  transactionParser: parserMock,
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  contextModule: contextModuleMock,
                  chainId: 1,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            expect(signTransactionMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  derivationPath: "44'/60'/0'/0/0",
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  chainId: 1,
                  transactionType: TransactionType.LEGACY,
                  clearSigningType: ClearSigningType.EIP7730, // TODO: should be standard
                },
              }),
            );
            resolve();
          },
        });
      }));
  });

  describe("Web3Checks", () => {
    it("should call external dependencies with web3Checks enabled and supported", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.16.0", true, true);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfig -> BuildContext
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext error
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.16.0", true, true),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
          onError: reject,
        });
      }));

    it("should call external dependencies with web3Checks supported but disabled", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.16.0", false, true);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfig -> BuildContext
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext error
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.16.0", false, true),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
          onError: reject,
        });
      }));

    it("should call external dependencies with web3Checks opt-in, then enabled", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.16.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        web3CheckOptInMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { enabled: true } }),
        );
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfig -> Web3ChecksOptIn -> BuildContext
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // Web3ChecksOptIn state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
              step: SignTransactionDAStep.WEB3_CHECKS_OPT_IN,
            },
            status: DeviceActionStatus.Pending,
          },
          // Web3ChecksOptInResultCheck state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.WEB3_CHECKS_OPT_IN_RESULT,
              result: true,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext error
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(web3CheckOptInMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.16.0", true, false),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
          onError: reject,
        });
      }));

    it("should call external dependencies with web3Checks opt-in, then disabled", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.16.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        web3CheckOptInMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { enabled: false } }),
        );
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfig -> Web3ChecksOptIn -> BuildContext
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // Web3ChecksOptIn state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
              step: SignTransactionDAStep.WEB3_CHECKS_OPT_IN,
            },
            status: DeviceActionStatus.Pending,
          },
          // Web3ChecksOptInResultCheck state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.WEB3_CHECKS_OPT_IN_RESULT,
              result: false,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext error
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(web3CheckOptInMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.16.0", false, false),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
          onError: reject,
        });
      }));

    it("should provide web3Checks context if getWeb3Check return a value", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        // Mock the dependencies to return some sample data
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: ClearSignContextType.TRANSACTION_INFO,
              payload: "payload-1",
            },
            {
              type: ClearSignContextType.WEB3_CHECK,
              payload: "0x01020304",
              certificate: {
                payload: new Uint8Array(),
                keyUsageNumber: 1,
              },
            },
          ],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 1,
          transactionType: TransactionType.LEGACY,
          clearSigningType: ClearSigningType.EIP7730,
          clearSignContextsOptional: [],
        });
        buildSubContextAndProvideMock.mockResolvedValueOnce(Just(void 0));
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

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
            status: DeviceActionStatus.Pending,
          },
          // Final state
          {
            output: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
            status: DeviceActionStatus.Completed,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            // Verify mocks calls parameters
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: contextModuleMock,
                  mapper: mapperMock,
                  options: defaultOptions,
                  transaction: defaultTransaction,
                  appConfig: createAppConfig("1.15.0", false, false),
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            expect(buildSubContextAndProvideMock).toHaveBeenCalledTimes(2);
            expect(buildSubContextAndProvideMock).toHaveBeenNthCalledWith(
              1,
              expect.objectContaining({
                input: {
                  context: {
                    type: ClearSignContextType.TRANSACTION_INFO,
                    payload: "payload-1",
                  },
                  contextOptional: [],
                  transactionParser: parserMock,
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  contextModule: contextModuleMock,
                  chainId: 1,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            expect(buildSubContextAndProvideMock).toHaveBeenNthCalledWith(
              2,
              expect.objectContaining({
                input: {
                  context: {
                    type: ClearSignContextType.WEB3_CHECK,
                    payload: "0x01020304",
                    certificate: {
                      payload: new Uint8Array(),
                      keyUsageNumber: 1,
                    },
                  },
                  contextOptional: [],
                  transactionParser: parserMock,
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  contextModule: contextModuleMock,
                  chainId: 1,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            expect(signTransactionMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  derivationPath: "44'/60'/0'/0/0",
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                  chainId: 1,
                  transactionType: TransactionType.LEGACY,
                  clearSigningType: ClearSigningType.EIP7730,
                },
              }),
            );
            resolve();
          },
        });
      }));
  });

  describe("OpenApp errors", () => {
    it("should fail if OpenApp throw an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock(new UnknownDAError("OpenApp error"));

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp error
          {
            error: new UnknownDAError("OpenApp error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            resolve();
          },
        });
      }));
  });

  describe("BuildContext errors", () => {
    it("should fail if buildContext throws an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext error
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: resolve,
        });
      }));
  });

  describe("SignTransaction errors", () => {
    it("should fail if signTransaction returns an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppConfig("1.15.0", false, false);

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            transaction: defaultTransaction,
            options: defaultOptions,
            contextModule: contextModuleMock,
            mapper: mapperMock,
            parser: parserMock,
          },
        });

        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: ClearSignContextType.TRANSACTION_INFO,
              payload: "payload-1",
            },
          ],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          web3Check: null,
        });
        buildSubContextAndProvideMock.mockResolvedValueOnce(Just(void 0));
        signTransactionMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("signTransaction error"),
          }),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              step: SignTransactionDAStep.OPEN_APP,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetAppConfig state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_SUB_CONTEXT_AND_PROVIDE,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction error
          {
            error: new InvalidStatusWordError("signTransaction error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: resolve,
        });
      }));
  });
});
