import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionStatus,
  OpenAppDeviceAction,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-sdk-core";
import { Just, Left, Nothing, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import {
  SignTypedDataDAState,
  SignTypedDataError,
} from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type ProvideEIP712ContextTaskArgs } from "@internal/app-binder/task/ProvideEIP712ContextTask";
import {
  PrimitiveType,
  StructType,
  TypedDataValueField,
} from "@internal/typed-data/model/Types";
import { TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { SignTypedDataDeviceAction } from "./SignTypedDataDeviceAction";

jest.mock(
  "@ledgerhq/device-sdk-core",
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  () => ({
    ...jest.requireActual("@ledgerhq/device-sdk-core"),
    OpenAppDeviceAction: jest.fn(() => ({
      makeStateMachine: jest.fn(),
    })),
  }),
);

const setupOpenAppDAMock = (error?: unknown) => {
  (OpenAppDeviceAction as jest.Mock).mockImplementation(() => ({
    makeStateMachine: jest.fn().mockImplementation(() =>
      createMachine({
        initial: "pending",
        states: {
          pending: {
            entry: assign({
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
              },
            }),
            after: {
              0: "done",
            },
          },
          done: {
            type: "final",
          },
        },
        output: () => (error ? Left(error) : Right(undefined)),
      }),
    ),
  }));
};

describe("SignTypedDataDeviceAction", () => {
  const TEST_MESSAGE = {
    domain: {},
    message: {},
    primaryType: "TestMessage",
    types: {},
  };
  const TEST_BUILT_CONTEXT: ProvideEIP712ContextTaskArgs = {
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
    parse: jest.fn(),
  };
  const mockContextModule: ContextModule = {
    getContexts: jest.fn(),
    getTypedDataFilters: jest.fn(),
  };
  const buildContextMock = jest.fn();
  const provideContextMock = jest.fn();
  const signTypedDataMock = jest.fn();
  function extractDependenciesMock() {
    return {
      buildContext: buildContextMock,
      provideContext: provideContextMock,
      signTypedData: signTypedDataMock,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignTypedDataDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          data: TEST_MESSAGE,
          contextModule: mockContextModule,
          parser: mockParser,
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
          expect(buildContextMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                contextModule: mockContextModule,
                parser: mockParser,
                data: TEST_MESSAGE,
              },
            }),
          );
          expect(provideContextMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
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
        },
      });
    });
  });

  describe("error cases", () => {
    it("Error if the open app fails", (done) => {
      setupOpenAppDAMock(new SignTypedDataError("Mocked error"));

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
          error: new SignTypedDataError("Mocked error"),
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

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("Error while building context", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignTypedDataDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          data: TEST_MESSAGE,
          contextModule: mockContextModule,
          parser: mockParser,
        },
      });

      // Mock the parsing error
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      buildContextMock.mockRejectedValueOnce(new Error("Error"));

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
          error: new SignTypedDataError(
            "Error while building the clear signing context",
          ),
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

    it("Error while providing context", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignTypedDataDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          data: TEST_MESSAGE,
          contextModule: mockContextModule,
          parser: mockParser,
        },
      });

      // Mock the providing error
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      buildContextMock.mockResolvedValueOnce(TEST_BUILT_CONTEXT);
      provideContextMock.mockRejectedValueOnce(new Error("Error"));

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
          error: new SignTypedDataError(
            "Error while providing the clear signing context",
          ),
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

    it("Error while signing", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignTypedDataDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          data: TEST_MESSAGE,
          contextModule: mockContextModule,
          parser: mockParser,
        },
      });

      // Mock signing error
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
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
          error: new UnknownDeviceExchangeError(
            "Error while signing the typed data",
          ),
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
