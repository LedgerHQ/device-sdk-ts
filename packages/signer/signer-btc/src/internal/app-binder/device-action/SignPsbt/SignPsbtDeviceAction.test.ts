import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { UnknownDAError } from "@ledgerhq/device-management-kit";
import { InvalidStatusWordError } from "@ledgerhq/device-management-kit";

import { type SignPsbtDAState } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type RegisteredWallet } from "@api/model/Wallet";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { SignPsbtDeviceAction } from "./SignPsbtDeviceAction";

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

describe("SignPsbtDeviceAction", () => {
  const signPersonalPsbtMock = jest.fn();

  function extractDependenciesMock() {
    return {
      signPsbt: signPersonalPsbtMock,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPsbtDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalPsbtMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: [Uint8Array.from([0x01, 0x02, 0x03])],
        }),
      );

      // Expected intermediate values for the following state sequence:
      //   Initial -> OpenApp -> BuildContext -> ProvideContext -> SignTypedData
      const expectedStates: Array<SignPsbtDAState> = [
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
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
          },
          status: DeviceActionStatus.Pending,
        },
        {
          output: [Uint8Array.from([0x01, 0x02, 0x03])],
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
          expect(signPersonalPsbtMock).toHaveBeenCalledWith(
            expect.objectContaining({
              input: {
                wallet: {} as unknown as RegisteredWallet,
                psbt: "Hello world",
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

      const expectedStates: Array<SignPsbtDAState> = [
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

      const deviceAction = new SignPsbtDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
        },
      });

      testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
        done,
      );
    });

    it("Error if the signPsbt fails", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPsbtDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalPsbtMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Mocked error"),
        }),
      );

      const expectedStates: Array<SignPsbtDAState> = [
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
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

    it("Error if the signPsbt throws an exception", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPsbtDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalPsbtMock.mockRejectedValueOnce(
        new InvalidStatusWordError("Mocked error"),
      );

      const expectedStates: Array<SignPsbtDAState> = [
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
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

    it("Error if signPsbt return an error", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignPsbtDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalPsbtMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Mocked error"),
        }),
      );

      const expectedStates: Array<SignPsbtDAState> = [
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
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
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

      const deviceAction = new SignPsbtDeviceAction({
        input: {
          wallet: {} as unknown as RegisteredWallet,
          psbt: "Hello world",
        },
      });

      // Mock the dependencies to return some sample data
      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockReturnValue(extractDependenciesMock());
      signPersonalPsbtMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: undefined,
        }),
      );

      const expectedStates: Array<SignPsbtDAState> = [
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
            requiredUserInteraction: UserInteractionRequired.SignTransaction,
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
