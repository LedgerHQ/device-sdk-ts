/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionStatus,
  hexaStringToBuffer,
  UnknownDAError,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";
import { Just, Nothing } from "purify-ts";

import { type SignTransactionDAState } from "@api/app-binder/SignTransactionDeviceActionTypes";
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
  };
  const mapperMock: TransactionMapperService = {
    mapTransactionToSubset: vi.fn(),
  } as unknown as TransactionMapperService;
  const parserMock: TransactionParserService = {
    extractValue: vi.fn(),
  } as unknown as TransactionParserService;
  const getChallengeMock = vi.fn();
  const buildContextMock = vi.fn();
  const provideContextMock = vi.fn();
  const provideGenericContextMock = vi.fn();
  const signTransactionMock = vi.fn();
  const getWeb3CheckMock = vi.fn();
  function extractDependenciesMock() {
    return {
      getChallenge: getChallengeMock,
      buildContext: buildContextMock,
      provideContext: provideContextMock,
      provideGenericContext: provideGenericContextMock,
      signTransaction: signTransactionMock,
      getWeb3Check: getWeb3CheckMock,
    };
  }
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Happy path", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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
        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
        });
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
        });
        provideContextMock.mockResolvedValueOnce(Nothing);
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
        //   Initial -> OpenApp -> GetChallenge -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Check state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onDone: () => {
              // Verify mocks calls parameters
              expect(getChallengeMock).toHaveBeenCalled();
              expect(buildContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    challenge: "challenge",
                    contextModule: contextModuleMock,
                    mapper: mapperMock,
                    options: defaultOptions,
                    transaction: defaultTransaction,
                  },
                }),
              );

              expect(provideContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    clearSignContexts: [
                      {
                        type: "token",
                        payload: "payload-1",
                      },
                    ],
                    web3Check: null,
                  },
                }),
              );

              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    isLegacy: true,
                    chainId: 1,
                    transactionType: TransactionType.LEGACY,
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("should call external dependencies with the correct parameters with the generic parser", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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
        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
        });
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: {
            transactionInfo: "payload-1",
            transactionFields: [
              {
                type: "enum",
                payload: "payload-2",
              },
            ],
          },
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 7,
          transactionType: TransactionType.EIP1559,
        });
        provideGenericContextMock.mockResolvedValueOnce(Nothing);
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
        //   Initial -> OpenApp -> GetChallenge -> BuildContext -> ProvideGenericContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              // Verify mocks calls parameters
              expect(getChallengeMock).toHaveBeenCalled();
              expect(buildContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    challenge: "challenge",
                    contextModule: contextModuleMock,
                    mapper: mapperMock,
                    options: defaultOptions,
                    transaction: defaultTransaction,
                  },
                }),
              );

              expect(provideGenericContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    chainId: 7,
                    context: {
                      transactionInfo: "payload-1",
                      transactionFields: [
                        {
                          type: "enum",
                          payload: "payload-2",
                        },
                      ],
                    },
                    contextModule: contextModuleMock,
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    transactionParser: parserMock,
                    web3Check: null,
                  },
                }),
              );
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    isLegacy: false,
                    chainId: 7,
                    transactionType: TransactionType.EIP1559,
                  },
                }),
              );
              resolve();
            },
          },
        );
      }));

    it("should fallback to blind signing if provideContext return an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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
        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
        });
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
        });
        provideContextMock.mockResolvedValueOnce(
          Just(
            CommandResultFactory({
              error: new InvalidStatusWordError("provideContext error"),
            }),
          ),
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
        //   Initial -> OpenApp -> GetChallenge -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              // Verify mocks calls parameters
              expect(getChallengeMock).toHaveBeenCalled();
              expect(buildContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    challenge: "challenge",
                    contextModule: contextModuleMock,
                    mapper: mapperMock,
                    options: defaultOptions,
                    transaction: defaultTransaction,
                  },
                }),
              );
              expect(provideContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    clearSignContexts: [
                      {
                        type: "token",
                        payload: "payload-1",
                      },
                    ],
                    web3Check: null,
                  },
                }),
              );
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    isLegacy: true,
                    chainId: 1,
                    transactionType: TransactionType.LEGACY,
                  },
                }),
              );
              resolve();
            },
          },
        );
      }));

    it("should fallback to blind signing if provideGenericContext return an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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
        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
        });
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: {
            transactionInfo: "payload-1",
            transactionFields: [
              {
                type: "enum",
                payload: "payload-2",
              },
            ],
          },
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 7,
          transactionType: TransactionType.EIP1559,
        });

        provideGenericContextMock.mockResolvedValueOnce(
          Just(
            CommandResultFactory({
              error: new InvalidStatusWordError("provideGenericContext error"),
            }),
          ),
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
        //   Initial -> OpenApp -> GetChallenge -> BuildContext -> ProvideGenericContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              // Verify mocks calls parameters
              expect(getChallengeMock).toHaveBeenCalled();
              expect(buildContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    challenge: "challenge",
                    contextModule: contextModuleMock,
                    mapper: mapperMock,
                    options: defaultOptions,
                    transaction: defaultTransaction,
                  },
                }),
              );

              expect(provideGenericContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    chainId: 7,
                    context: {
                      transactionInfo: "payload-1",
                      transactionFields: [
                        {
                          type: "enum",
                          payload: "payload-2",
                        },
                      ],
                    },
                    contextModule: contextModuleMock,
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    transactionParser: parserMock,
                    web3Check: null,
                  },
                }),
              );
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    isLegacy: false,
                    chainId: 7,
                    transactionType: TransactionType.EIP1559,
                  },
                }),
              );
              resolve();
            },
          },
        );
      }));

    it("should continue if getChallenge return an error 6d00 not supported", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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
        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError({
              message: "UnknownError",
              errorCode: "6d00",
            }),
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
        });
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          chainId: 7,
          transactionType: TransactionType.EIP1559,
        });

        provideGenericContextMock.mockResolvedValueOnce(Nothing);

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
        //   Initial -> OpenApp -> GetChallenge -> BuildContext -> ProvideGenericContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              // Verify mocks calls parameters
              expect(getChallengeMock).toHaveBeenCalled();
              expect(buildContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    challenge: null,
                    contextModule: contextModuleMock,
                    mapper: mapperMock,
                    options: defaultOptions,
                    transaction: defaultTransaction,
                  },
                }),
              );
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    isLegacy: true,
                    chainId: 7,
                    transactionType: TransactionType.EIP1559,
                  },
                }),
              );
              resolve();
            },
          },
        );
      }));

    it("should provide web3checks context if getWeb3Check return a value", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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
        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: {
            type: ClearSignContextType.ENUM,
            id: 1,
            payload: "0x01020304",
            value: 1,
            certificate: undefined,
          },
        });
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
        });
        provideContextMock.mockResolvedValueOnce(Nothing);
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
        //   Initial -> OpenApp -> GetChallenge -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              // Verify mocks calls parameters
              expect(getChallengeMock).toHaveBeenCalled();
              expect(buildContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    challenge: "challenge",
                    contextModule: contextModuleMock,
                    mapper: mapperMock,
                    options: defaultOptions,
                    transaction: defaultTransaction,
                  },
                }),
              );
              expect(provideContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    clearSignContexts: [
                      {
                        type: "token",
                        payload: "payload-1",
                      },
                    ],
                    web3Check: {
                      type: ClearSignContextType.ENUM,
                      id: 1,
                      payload: "0x01020304",
                      value: 1,
                      certificate: undefined,
                    },
                  },
                }),
              );
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    isLegacy: true,
                    chainId: 1,
                    transactionType: TransactionType.LEGACY,
                  },
                }),
              );
              resolve();
            },
          },
        );
      }));

    it("should ignore web3checks errors", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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
        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
          error: new InvalidStatusWordError("getWeb3Check error"),
        });
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
        });
        provideContextMock.mockResolvedValueOnce(Nothing);
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
        //   Initial -> OpenApp -> GetChallenge -> BuildContext -> ProvideContext -> SignTransaction
        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              // Verify mocks calls parameters
              expect(getChallengeMock).toHaveBeenCalled();
              expect(buildContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    challenge: "challenge",
                    contextModule: contextModuleMock,
                    mapper: mapperMock,
                    options: defaultOptions,
                    transaction: defaultTransaction,
                  },
                }),
              );
              expect(provideContextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    clearSignContexts: [
                      {
                        type: "token",
                        payload: "payload-1",
                      },
                    ],
                    web3Check: null,
                  },
                }),
              );
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: "44'/60'/0'/0/0",
                    serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                    isLegacy: true,
                    chainId: 1,
                    transactionType: TransactionType.LEGACY,
                  },
                }),
              );
              resolve();
            },
          },
        );
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
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp error
          {
            error: new UnknownDAError("OpenApp error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              resolve();
            },
          },
        );
      }));
  });

  describe("GetChallenge errors", () => {
    it("should fail if getChallenge throws an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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

        getChallengeMock.mockRejectedValueOnce(
          new InvalidStatusWordError("getChallenge error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge error
          {
            error: new InvalidStatusWordError("getChallenge error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: resolve,
          },
        );
      }));

    it("should fail if getChallenge return an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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

        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("getChallenge error"),
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
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge error
          {
            error: new InvalidStatusWordError("getChallenge error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: resolve,
          },
        );
      }));
  });

  describe("GetWeb3Checks errors", () => {
    it("should fail if GetWeb3Checks throws an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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

        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockRejectedValueOnce(
          new InvalidStatusWordError("getWeb3Checks error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Checks error
          {
            error: new InvalidStatusWordError("getWeb3Checks error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: () => {
              resolve();
            },
          },
        );
      }));
  });

  describe("BuildContext errors", () => {
    it("should fail if buildContext throws an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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

        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
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
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Check state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext error
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: resolve,
          },
        );
      }));
  });

  describe("ProvideContext errors", () => {
    it("should fail if provideContext throws an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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

        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
        });
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: "token",
              payload: "payload-1",
            },
          ],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
        });
        provideContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("provideContext error"),
        );
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );

        const expectedStates: Array<SignTransactionDAState> = [
          // Initial state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Check state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext error
          {
            error: new InvalidStatusWordError("provideContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: resolve,
          },
        );
      }));
  });

  describe("SignTransaction errors", () => {
    it("should fail if signTransaction returns an error", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();

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

        getChallengeMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: { challenge: "challenge" },
          }),
        );
        getWeb3CheckMock.mockResolvedValueOnce({
          web3Check: null,
        });
        buildContextMock.mockResolvedValueOnce({
          clearSignContexts: [
            {
              type: "token",
              payload: "payload-1",
            },
          ],
          serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
        });
        provideContextMock.mockResolvedValueOnce(Nothing);
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
            },
            status: DeviceActionStatus.Pending,
          },
          // OpenApp interaction
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetChallenge state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // GetWeb3Check state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // BuildContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // ProvideContext state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction error
          {
            error: new InvalidStatusWordError("signTransaction error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          {
            onError: reject,
            onDone: resolve,
          },
        );
      }));
  });
});
