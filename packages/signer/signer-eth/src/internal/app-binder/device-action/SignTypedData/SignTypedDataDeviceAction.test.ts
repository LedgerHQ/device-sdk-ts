/* eslint @typescript-eslint/consistent-type-imports: 0 */
import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
  UnknownDAError,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { type SignTypedDataDAState } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { EthAppCommandErrorFactory } from "@internal/app-binder/command/utils/ethAppErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type ProvideEIP712ContextTaskArgs } from "@internal/app-binder/task/ProvideEIP712ContextTask";
import {
  PrimitiveType,
  StructType,
  TypedDataValueField,
} from "@internal/typed-data/model/Types";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { SignTypedDataDeviceAction } from "./SignTypedDataDeviceAction";

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

describe("SignTypedDataDeviceAction", () => {
  const TEST_MESSAGE = {
    domain: {},
    message: {},
    primaryType: "TestMessage",
    types: {},
  };
  const TEST_BUILT_CONTEXT: ProvideEIP712ContextTaskArgs = {
    web3Check: null,
    messageHash:
      "0x8887109c22cd7358af93c04b5397e91b1331e0c389951542e11af4b227a4aa1d",
    domainHash:
      "0x06c37168a7db5138defc7866392bb87a741f9b3d104deb5094588ce041cae335",
    types: {
      PermitSingle: {
        details: new StructType("PermitDetails"),
        spender: new PrimitiveType("address", "address", Nothing),
        sigDeadline: new PrimitiveType("uint256", "uint", Just(32)),
      },
    },
    domain: [
      {
        path: "chainId",
        type: "uint256",
        value: new TypedDataValueField(Uint8Array.from([137])),
      },
    ],
    message: [
      {
        path: "details.expiration",
        type: "uint48",
        value: new TypedDataValueField(Uint8Array.from([0x13])),
      },
    ],
    clearSignContext: Just({
      type: "success",
      messageInfo: {
        displayName: "Permit2",
        filtersCount: 1,
        signature:
          "3045022100e3c597d13d28a87a88b0239404c668373cf5063362f2a81d09eed4582941dfe802207669aabb504fd5b95b2734057f6b8bbf51f14a69a5f9bdf658a5952cefbf44d3",
      },
      trustedNamesAddresses: {},
      tokens: {},
      filters: {
        "details.amount": {
          displayName: "Amount allowance",
          path: "details.amount",
          signature:
            "304402201a46e6b4ef89eaf9fcf4945d053bfc5616a826400fd758312fbbe976bafc07ec022025a9b408722baf983ee053f90179c75b0c55bb0668f437d55493e36069bbd5a3",
          tokenIndex: 255,
          type: "amount",
        },
      },
    }),
  };

  const mockParser: TypedDataParserService = {
    parse: vi.fn(),
  };
  const mockContextModule: ContextModule = {
    getContext: vi.fn(),
    getContexts: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getWeb3Checks: vi.fn(),
  };
  const apiMock = makeDeviceActionInternalApiMock();
  const getAppConfigMock = vi.fn();
  const web3CheckOptInMock = vi.fn();
  const buildContextMock = vi.fn();
  const provideContextMock = vi.fn();
  const signTypedDataMock = vi.fn();
  const signTypedDataLegacyMock = vi.fn();
  function extractDependenciesMock() {
    return {
      getAppConfig: getAppConfigMock,
      web3CheckOptIn: web3CheckOptInMock,
      buildContext: buildContextMock,
      provideContext: provideContextMock,
      signTypedData: signTypedDataMock,
      signTypedDataLegacy: signTypedDataLegacyMock,
    };
  }

  function setupAppVersion(version: string) {
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.15.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        buildContextMock.mockResolvedValueOnce(TEST_BUILT_CONTEXT);
        provideContextMock.mockResolvedValueOnce(
          CommandResultFactory({ data: undefined }),
        );
        signTypedDataMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
          }),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> BuildContext -> ProvideContext -> SignTypedData
        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
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
                  contextModule: mockContextModule,
                  parser: mockParser,
                  data: TEST_MESSAGE,
                  web3ChecksEnabled: false,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );

            expect(provideContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: mockContextModule,
                  taskArgs: TEST_BUILT_CONTEXT,
                },
              }),
            );

            expect(signTypedDataMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );

            resolve();
          },
        });
      }));

    it("should fallback to legacy signing if the new one fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.15.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the providing error
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        buildContextMock.mockResolvedValueOnce(TEST_BUILT_CONTEXT);
        provideContextMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: EthAppCommandErrorFactory({
              errorCode: "6a80",
              message: "",
            }),
          }),
        );
        signTypedDataLegacyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
          }),
        );

        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
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
          onDone: resolve,
        });
      }));

    it("should not fallback to legacy signing if rejected by the user during streaming", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.15.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the providing error
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        buildContextMock.mockResolvedValueOnce(TEST_BUILT_CONTEXT);
        provideContextMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: EthAppCommandErrorFactory({
              errorCode: "6985",
              message: "",
            }),
          }),
        );
        signTypedDataLegacyMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              v: 0x1c,
              r: "0x8a540510e13b0f2b11a451275716d29e08caad07e89a1c84964782fb5e1ad788",
              s: "0x64a0de235b270fbe81e8e40688f4a9f9ad9d283d690552c9331d7773ceafa513",
            },
          }),
        );

        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: EthAppCommandErrorFactory({
              errorCode: "6985",
              message: "",
            }),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: resolve,
        });
      }));
  });

  describe("Web3Checks", () => {
    it("should call external dependencies with web3Checks enabled and supported", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.16.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              blindSigningEnabled: false,
              web3ChecksEnabled: true,
              web3ChecksOptIn: true,
              version: "1.16.0",
            },
          }),
        );
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfiguration -> BuildContext
        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: mockContextModule,
                  parser: mockParser,
                  data: TEST_MESSAGE,
                  web3ChecksEnabled: true,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
        });
      }));

    it("should call external dependencies with web3Checks supported but disabled", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.16.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              blindSigningEnabled: false,
              web3ChecksEnabled: false,
              web3ChecksOptIn: true,
              version: "1.16.0",
            },
          }),
        );
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfiguration -> BuildContext
        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: mockContextModule,
                  parser: mockParser,
                  data: TEST_MESSAGE,
                  web3ChecksEnabled: false,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
        });
      }));

    it("should call external dependencies with web3Checks opt-in, then enabled", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.16.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              blindSigningEnabled: false,
              web3ChecksEnabled: false,
              web3ChecksOptIn: false,
              version: "1.16.0",
            },
          }),
        );
        web3CheckOptInMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { enabled: true } }),
        );
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfiguration -> Web3ChecksOptIn -> BuildContext
        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(web3CheckOptInMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: mockContextModule,
                  parser: mockParser,
                  data: TEST_MESSAGE,
                  web3ChecksEnabled: true,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
        });
      }));

    it("should call external dependencies with web3Checks opt-in, then enabled", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.16.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the dependencies to return some sample data
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        getAppConfigMock.mockResolvedValue(
          CommandResultFactory({
            data: {
              blindSigningEnabled: false,
              web3ChecksEnabled: false,
              web3ChecksOptIn: false,
              version: "1.16.0",
            },
          }),
        );
        web3CheckOptInMock.mockResolvedValueOnce(
          CommandResultFactory({ data: { enabled: true } }),
        );
        buildContextMock.mockRejectedValueOnce(
          new InvalidStatusWordError("buildContext error"),
        );

        // Expected intermediate values for the following state sequence:
        //   Initial -> OpenApp -> GetAppConfiguration -> Web3ChecksOptIn -> BuildContext
        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new InvalidStatusWordError("buildContext error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: () => {
            // Verify mocks calls parameters
            expect(getAppConfigMock).toHaveBeenCalled();
            expect(web3CheckOptInMock).toHaveBeenCalled();
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule: mockContextModule,
                  parser: mockParser,
                  data: TEST_MESSAGE,
                  web3ChecksEnabled: true,
                  derivationPath: "44'/60'/0'/0/0",
                },
              }),
            );
            resolve();
          },
        });
      }));
  });

  describe("error cases", () => {
    it("Error if the open app fails", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock(new UnknownDAError("Mocked error"));

        const expectedStates: Array<SignTypedDataDAState> = [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
          },
          {
            status: DeviceActionStatus.Error,
            error: new UnknownDAError("Mocked error"),
          },
        ];

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: resolve,
        });
      }));

    it("Error while building context", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.15.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the parsing error
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        buildContextMock.mockRejectedValueOnce(new UnknownDAError("Error"));

        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDAError("Error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: resolve,
        });
      }));

    it("Error thrown while providing context", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.15.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock the providing error
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        buildContextMock.mockResolvedValueOnce(TEST_BUILT_CONTEXT);
        provideContextMock.mockRejectedValueOnce(new UnknownDAError("Error"));

        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDAError("Error"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(deviceAction, expectedStates, apiMock, {
          onError: reject,
          onDone: resolve,
        });
      }));

    it("Error while signing", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        setupAppVersion("1.15.0");

        const deviceAction = new SignTypedDataDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            data: TEST_MESSAGE,
            contextModule: mockContextModule,
            parser: mockParser,
          },
        });

        // Mock signing error
        vi.spyOn(deviceAction, "extractDependencies").mockReturnValue(
          extractDependenciesMock(),
        );
        buildContextMock.mockResolvedValueOnce(TEST_BUILT_CONTEXT);
        provideContextMock.mockResolvedValueOnce(
          CommandResultFactory({ data: undefined }),
        );
        signTypedDataMock.mockResolvedValueOnce(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError(
              "Error while signing the typed data",
            ),
          }),
        );

        const expectedStates: Array<SignTypedDataDAState> = [
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
            status: DeviceActionStatus.Pending,
          },
          {
            error: new UnknownDeviceExchangeError(
              "Error while signing the typed data",
            ),
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
