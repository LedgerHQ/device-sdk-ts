import {
  CommandResultFactory,
  DeviceActionStatus,
  InvalidStatusWordError,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { type SignTransactionDAState } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Transaction } from "@api/model/Transaction";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { setupOpenAppDAMock } from "@internal/app-binder/device-action/__test-utils__/setupOpenAppDAMock";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

vi.mock("@ledgerhq/device-management-kit", async (importOrignal) => {
  const original =
    await importOrignal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    OpenAppDeviceAction: vi.fn(() => ({
      makeStateMachine: vi.fn(),
    })),
  };
});

describe("SignTransactionDeviceAction", () => {
  const signTransactionMock = vi.fn();
  function extractDependenciesMock() {
    return {
      signTransaction: signTransactionMock,
    };
  }
  const defaultOptions = {};
  let defaultTransaction: Transaction;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultTransaction = new Uint8Array([0x01, 0x02, 0x03]);
  });

  describe("Happy path", () => {
    it("should call external dependencies with the correct parameters", () =>
      new Promise((done) => {
        setupOpenAppDAMock();

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/501'/0'/0'",
            transaction: defaultTransaction,
            options: defaultOptions,
          },
        });

        // Mock the dependencies to return some sample data
        signTransactionMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: Just(new Uint8Array([0x05, 0x06, 0x07])),
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
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
            status: DeviceActionStatus.Pending,
          },
          // Final state
          {
            output: new Uint8Array([0x05, 0x06, 0x07]),
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
            expect(signTransactionMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  derivationPath: "44'/501'/0'/0'",
                  serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                },
              }),
            );
          },
        });
      }));
  });

  describe("OpenApp errors", () => {
    it("should fail if OpenApp throw an error", () =>
      new Promise((done) => {
        setupOpenAppDAMock(new UnknownDAError("OpenApp error"));

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/501'/0'/0'",
            transaction: defaultTransaction,
            options: defaultOptions,
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
          done,
        );
      }));
  });

  describe("SignTransaction errors", () => {
    it("should fail if signTransaction returns an error", () =>
      new Promise((done) => {
        setupOpenAppDAMock();

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/501'/0'/0'",
            transaction: defaultTransaction,
            options: defaultOptions,
          },
        });

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
      }));

    it("should fail if signTransaction returns nothing", () =>
      new Promise((done) => {
        setupOpenAppDAMock();

        const deviceAction = new SignTransactionDeviceAction({
          input: {
            derivationPath: "44'/501'/0'/0'",
            transaction: defaultTransaction,
            options: defaultOptions,
          },
        });

        signTransactionMock.mockResolvedValueOnce(
          CommandResultFactory({
            data: Nothing,
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
          // SignTransaction state
          {
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
            status: DeviceActionStatus.Pending,
          },
          // SignTransaction error
          {
            error: new UnknownDAError("No Signature available"),
            status: DeviceActionStatus.Error,
          },
        ];

        testDeviceActionStates(
          deviceAction,
          expectedStates,
          makeDeviceActionInternalApiMock(),
          done,
        );
      }));
  });

  describe("extractDependencies", () => {
    it("should extract dependencies", async () => {
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: "44'/501'/0'/0'",
          transaction: defaultTransaction,
          options: defaultOptions,
        },
      });
      // mock sendCommand to return a successful result
      const api = makeDeviceActionInternalApiMock();
      vi.spyOn(api, "sendCommand").mockResolvedValue(
        CommandResultFactory({
          data: Just(new Uint8Array([0x05, 0x06, 0x07])),
        }),
      );

      const dependencies = deviceAction.extractDependencies(api);

      const signature = await dependencies.signTransaction({
        input: {
          derivationPath: "44'/501'/0'/0'",
          serializedTransaction: defaultTransaction,
        },
      });

      expect(dependencies.signTransaction).toBeInstanceOf(Function);
      expect(signature).toEqual(
        CommandResultFactory({
          data: Just(new Uint8Array([0x05, 0x06, 0x07])),
        }),
      );
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
    });
  });
});
