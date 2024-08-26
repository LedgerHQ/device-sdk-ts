import {
  CommandResultFactory,
  DeviceActionStatus,
  OpenAppDeviceAction,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-sdk-core";
import { UnknownDAError } from "@ledgerhq/device-sdk-core";
import { InvalidStatusWordError } from "@ledgerhq/device-sdk-core";
import { Left, Right } from "purify-ts";
import { assign, createMachine } from "xstate";

import { SignPersonalMessageDAState } from "@api/index";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { SignPersonalMessageDeviceAction } from "./SignPersonalMessageDeviceAction";

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

describe("SignPersonalMessageDeviceAction", () => {
  const signPersonalMessageMock = jest.fn();

  function extractDependenciesMock() {
    return {
      signPersonalMessage: signPersonalMessageMock,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPersonalMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalMessageMock.mockResolvedValueOnce(
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
      const expectedStates: Array<SignPersonalMessageDAState> = [
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
            requiredUserInteraction:
              UserInteractionRequired.SignPersonalMessage,
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
          expect(signPersonalMessageMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                derivationPath: "44'/60'/0'/0/0",
                message: "Hello world",
              },
            }),
          );
        },
      });
    });
  });

  describe("error cases", () => {
    it("Error if the open app fails", (done) => {
      setupOpenAppDAMock(new UnknownDeviceExchangeError("Mocked error"));

      const expectedStates: Array<SignPersonalMessageDAState> = [
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
          error: new UnknownDeviceExchangeError("Mocked error"),
        },
      ];

      const deviceAction = new SignPersonalMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("Error if the signPersonalMessage fails", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPersonalMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalMessageMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Mocked error"),
        }),
      );

      const expectedStates: Array<SignPersonalMessageDAState> = [
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
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction:
              UserInteractionRequired.SignPersonalMessage,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDeviceExchangeError("Mocked error"),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("Error if the signPersonalMessage throws an exception", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPersonalMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalMessageMock.mockRejectedValueOnce(
        new InvalidStatusWordError("Mocked error"),
      );

      const expectedStates: Array<SignPersonalMessageDAState> = [
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
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction:
              UserInteractionRequired.SignPersonalMessage,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new InvalidStatusWordError("Mocked error"),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("Error if signPersonalMessage return an error", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPersonalMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalMessageMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Mocked error"),
        }),
      );

      const expectedStates: Array<SignPersonalMessageDAState> = [
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
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction:
              UserInteractionRequired.SignPersonalMessage,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDeviceExchangeError("Mocked error"),
        },
      ];

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("Return a Left if the final state has no signature", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPersonalMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalMessageMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: undefined,
        }),
      );

      const expectedStates: Array<SignPersonalMessageDAState> = [
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
          status: DeviceActionStatus.Pending,
          intermediateValue: {
            requiredUserInteraction:
              UserInteractionRequired.SignPersonalMessage,
          },
        },
        {
          status: DeviceActionStatus.Error,
          error: new UnknownDAError("No error in final state"),
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
