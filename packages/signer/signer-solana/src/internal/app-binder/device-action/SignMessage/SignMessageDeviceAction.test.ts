import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDeviceExchangeError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { UnknownDAError } from "@ledgerhq/device-management-kit";

import { type SignMessageDAState } from "@api/app-binder/SignMessageDeviceActionTypes";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { SignMessageDeviceAction } from "@internal/app-binder/device-action/SignMessage/SignMessageDeviceAction";

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

describe("SignMessageDeviceAction", () => {
  const signMessageMock = jest.fn();

  function extractDependenciesMock() {
    return {
      signMessage: signMessageMock,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignMessageDeviceAction({
        input: {
          derivationPath: "44'/501'/0'/0'",
          message: "Hello world",
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockImplementation(() => extractDependenciesMock());

      const signatureData = new Uint8Array([
        // signature data...
      ]);

      signMessageMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: signatureData,
        }),
      );

      const expectedStates: Array<SignMessageDAState> = [
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
          output: signatureData,
          status: DeviceActionStatus.Completed,
        },
      ];

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
      );

      observable.subscribe({
        complete: () => {
          try {
            expect(signMessageMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: expect.objectContaining({
                  derivationPath: "44'/501'/0'/0'",
                  sendingData: new TextEncoder().encode("Hello world"),
                }),
              }),
            );
            done();
          } catch (error) {
            done(error);
          }
        },
        error: (err) => {
          done(err);
        },
      });
    });
  });

  describe("error cases", () => {
    it("Error if the open app fails", (done) => {
      setupOpenAppDAMock(new UnknownDeviceExchangeError("Mocked error"));

      const expectedStates: Array<SignMessageDAState> = [
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

      const deviceAction = new SignMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockImplementation(() => extractDependenciesMock());

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
      );

      observable.subscribe({
        complete: () => {
          try {
            expect(signMessageMock).not.toHaveBeenCalled();
            done();
          } catch (error) {
            done(error);
          }
        },
        error: (err) => {
          done(err);
        },
      });
    });

    it("Error if the signMessage fails", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockImplementation(() => extractDependenciesMock());

      signMessageMock.mockResolvedValueOnce(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Mocked error"),
        }),
      );

      const expectedStates: Array<SignMessageDAState> = [
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

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
      );

      observable.subscribe({
        complete: () => {
          try {
            expect(signMessageMock).toHaveBeenCalled();
            done();
          } catch (error) {
            done(error);
          }
        },
        error: (err) => {
          done(err);
        },
      });
    });

    it("Return a Left if the final state has no signature", (done) => {
      setupOpenAppDAMock();

      const deviceAction = new SignMessageDeviceAction({
        input: {
          derivationPath: "44'/60'/0'/0/0",
          message: "Hello world",
        },
      });

      jest
        .spyOn(deviceAction, "extractDependencies")
        .mockImplementation(() => extractDependenciesMock());

      signMessageMock.mockResolvedValueOnce(
        CommandResultFactory({
          data: undefined,
        }),
      );

      const expectedStates: Array<SignMessageDAState> = [
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

      const { observable } = testDeviceActionStates(
        deviceAction,
        expectedStates,
        makeDeviceActionInternalApiMock(),
      );

      observable.subscribe({
        complete: () => {
          try {
            expect(signMessageMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: expect.objectContaining({
                  derivationPath: "44'/60'/0'/0/0",
                  sendingData: new TextEncoder().encode("Hello world"),
                }),
              }),
            );
            done();
          } catch (error) {
            done(error);
          }
        },
        error: (err) => {
          done(err);
        },
      });
    });
  });
});
