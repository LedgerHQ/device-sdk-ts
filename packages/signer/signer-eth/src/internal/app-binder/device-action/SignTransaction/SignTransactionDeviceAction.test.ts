import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers-v6";
import { Just, Nothing } from "purify-ts";

import { type SignTransactionDAState } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { TransactionType } from "@api/model/Transaction";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

jest.mock(
  "@ledgerhq/device-management-kit",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  () => ({
    ...jest.requireActual("@ledgerhq/device-management-kit"),
    OpenAppDeviceAction: jest.fn(() => ({
      makeStateMachine: jest.fn(),
    })),
  }),
);

describe("SignTransactionDeviceAction", () => {
  const contextModuleMock: ContextModule = {
    getContext: jest.fn(),
    getContexts: jest.fn(),
    getTypedDataFilters: jest.fn(),
  };
  const mapperMock: TransactionMapperService = {
    mapTransactionToSubset: jest.fn(),
  } as unknown as TransactionMapperService;
  const parserMock: TransactionParserService = {
    extractValue: jest.fn(),
  } as unknown as TransactionParserService;
  const getChallengeMock = jest.fn();
  const buildContextMock = jest.fn();
  const provideContextMock = jest.fn();
  const provideGenericContextMock = jest.fn();
  const signTransactionMock = jest.fn();
  function extractDependenciesMock() {
    return {
      getChallenge: getChallengeMock,
      buildContext: buildContextMock,
      provideContext: provideContextMock,
      provideGenericContext: provideGenericContextMock,
      signTransaction: signTransactionMock,
    };
  }
  const defaultOptions = {
    domain: "domain-name.eth",
  };
  let defaultTransaction: Transaction;

  beforeEach(() => {
    jest.clearAllMocks();
    defaultTransaction = new Transaction();
    defaultTransaction.chainId = 1n;
    defaultTransaction.nonce = 0;
    defaultTransaction.data = "0x";
  });

  describe("Happy path", () => {
    it("should call external dependencies with the correct parameters", (done) => {
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
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );

      // Verify mocks calls parameters
      observable.subscribe({
        complete: () => {
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
        },
      });
    });

    it("should call external dependencies with the correct parameters with the generic parser", (done) => {
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
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );

      // Verify mocks calls parameters
      observable.subscribe({
        complete: () => {
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
                serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                transactionParser: parserMock,
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
        },
      });
    });
  });

  describe("OpenApp errors", () => {
    it("should fail if OpenApp throw an error", (done) => {
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

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
        done,
      );
    });
  });

  describe("GetChallenge errors", () => {
    it("should fail if getChallenge returns an error", (done) => {
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
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
        done,
      );
    });

    it("should fail if getChallenge throws an error", (done) => {
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
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
        done,
      );
    });
  });

  describe("BuildContext errors", () => {
    it("should fail if buildContext throws an error", (done) => {
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
      buildContextMock.mockRejectedValueOnce(
        new InvalidStatusWordError("buildContext error"),
      );
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
        done,
      );
    });
  });

  describe("ProvideContext errors", () => {
    it("should fail if provideContext returns an error", (done) => {
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
      buildContextMock.mockResolvedValueOnce({
        clearSignContexts: [
          {
            type: "token",
            payload: "payload-1",
          },
        ],
        serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
      });
      provideContextMock.mockResolvedValueOnce(
        Just(
          CommandResultFactory({
            error: new InvalidStatusWordError("provideContext error"),
          }),
        ),
      );
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
        done,
      );
    });

    it("should fail if provideContext throws an error", (done) => {
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
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
        done,
      );
    });
  });

  describe("SignTransaction errors", () => {
    it("should fail if signTransaction returns an error", (done) => {
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
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());

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
        done,
      );
    });
  });
});
