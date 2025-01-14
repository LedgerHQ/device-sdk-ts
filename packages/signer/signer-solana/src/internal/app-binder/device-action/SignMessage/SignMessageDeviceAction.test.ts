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

describe("SignMessageDeviceAction", () => {
  const signMessageMock = vi.fn();

  function extractDependenciesMock() {
    return {
      signMessage: signMessageMock,
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Success case", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise<Error | void>((done) => {
        setupOpenAppDAMock();

        const deviceAction = new SignMessageDeviceAction({
          input: {
            derivationPath: "44'/501'/0'/0'",
            message: "Hello world",
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(() =>
          extractDependenciesMock(),
        );

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
              done(error as Error);
            }
          },
          error: (err) => {
            done(err);
          },
        });
      }));
  });

  describe("error cases", () => {
    it("Error if the open app fails", () =>
      new Promise<Error | void>((done) => {
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

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(() =>
          extractDependenciesMock(),
        );

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
              done(error as Error);
            }
          },
          error: (err) => {
            done(err);
          },
        });
      }));

    it("Error if the signMessage fails", () =>
      new Promise<Error | void>((done) => {
        setupOpenAppDAMock();

        const deviceAction = new SignMessageDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            message: "Hello world",
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(() =>
          extractDependenciesMock(),
        );

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
              done(error as Error);
            }
          },
          error: (err) => {
            done(err);
          },
        });
      }));

    it("Return a Left if the final state has no signature", () =>
      new Promise<Error | void>((done) => {
        setupOpenAppDAMock();

        const deviceAction = new SignMessageDeviceAction({
          input: {
            derivationPath: "44'/60'/0'/0/0",
            message: "Hello world",
          },
        });

        vi.spyOn(deviceAction, "extractDependencies").mockImplementation(() =>
          extractDependenciesMock(),
        );

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
              done(error as Error);
            }
          },
          error: (err) => {
            done(err);
          },
        });
      }));
  });
});
