/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  CommandResultFactory,
  DeviceActionStatus,
  type LoggerPublisherService,
  OpenAppDeviceAction,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { assign, createMachine } from "xstate";

import { SignTransactionDAStep } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Curve } from "@api/model/Curve";
import { XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

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

const DERIVATION_PATH = "44'/144'/0'/0/0";
const TRANSACTION = new Uint8Array([0x12, 0x00, 0x00]);
const SIGNATURE = new Uint8Array([0x30, 0x44]);

const loggerFactory = (_tag: string): LoggerPublisherService =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  }) as unknown as LoggerPublisherService;

const setupOpenAppDAMock = (error?: unknown) => {
  (OpenAppDeviceAction as Mock).mockImplementation(() => ({
    makeStateMachine: vi.fn().mockImplementation(() =>
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

describe("SignTransactionDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signTransactionMock = vi.fn();

  const makeDeviceAction = (skipOpenApp: boolean) => {
    const deviceAction = new SignTransactionDeviceAction({
      input: {
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        skipOpenApp,
        curve: Curve.Secp256k1,
        loggerFactory,
      },
    });
    vi.spyOn(deviceAction, "extractDependencies").mockReturnValue({
      signTransaction: signTransactionMock,
    });
    return deviceAction;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    signTransactionMock.mockResolvedValue(
      CommandResultFactory({ data: SIGNATURE }),
    );
  });

  describe("skipOpenApp: true", () => {
    it("signs using derivationPath and transaction from machine input", () =>
      new Promise<void>((resolve, reject) => {
        const deviceAction = makeDeviceAction(true);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                step: SignTransactionDAStep.SIGN_TRANSACTION,
              },
            },
            {
              status: DeviceActionStatus.Completed,
              output: SIGNATURE,
            },
          ],
          apiMock,
          {
            onDone: () => {
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: DERIVATION_PATH,
                    transaction: TRANSACTION,
                    curve: Curve.Secp256k1,
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("forwards a command error from the sign task", () =>
      new Promise<void>((resolve, reject) => {
        const error = new XrpAppCommandError({
          message: "User refused",
          errorCode: "6985",
        });
        signTransactionMock.mockResolvedValue(CommandResultFactory({ error }));
        const deviceAction = makeDeviceAction(true);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                step: SignTransactionDAStep.SIGN_TRANSACTION,
              },
            },
            {
              status: DeviceActionStatus.Error,
              error,
            },
          ],
          apiMock,
          { onDone: resolve, onError: reject },
        );
      }));
  });

  describe("skipOpenApp: false", () => {
    it("opens the app, forwards ConfirmOpenApp, then signs", () =>
      new Promise<void>((resolve, reject) => {
        setupOpenAppDAMock();
        const deviceAction = makeDeviceAction(false);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction:
                  UserInteractionRequired.SignTransaction,
                step: SignTransactionDAStep.SIGN_TRANSACTION,
              },
            },
            {
              status: DeviceActionStatus.Completed,
              output: SIGNATURE,
            },
          ],
          apiMock,
          {
            onDone: () => {
              expect(signTransactionMock).toHaveBeenCalledTimes(1);
              expect(signTransactionMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  input: {
                    derivationPath: DERIVATION_PATH,
                    transaction: TRANSACTION,
                    curve: Curve.Secp256k1,
                  },
                }),
              );
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("errors when opening the app fails and does not sign", () =>
      new Promise<void>((resolve, reject) => {
        const openAppError = new UnknownDAError("OpenApp failed");
        setupOpenAppDAMock(openAppError);
        const deviceAction = makeDeviceAction(false);

        testDeviceActionStates(
          deviceAction,
          [
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.None,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Pending,
              intermediateValue: {
                requiredUserInteraction: UserInteractionRequired.ConfirmOpenApp,
                step: SignTransactionDAStep.OPEN_APP,
              },
            },
            {
              status: DeviceActionStatus.Error,
              error: openAppError,
            },
          ],
          apiMock,
          {
            onDone: () => {
              expect(signTransactionMock).not.toHaveBeenCalled();
              resolve();
            },
            onError: reject,
          },
        );
      }));
  });

  describe("serialized transaction validation", () => {
    it("rejects when transaction is empty (neither factory arg nor invoke input)", async () => {
      const deviceAction = new SignTransactionDeviceAction({
        input: {
          derivationPath: DERIVATION_PATH,
          transaction: new Uint8Array(),
          skipOpenApp: true,
          curve: Curve.Secp256k1,
          loggerFactory,
        },
      });
      const { signTransaction } = deviceAction.extractDependencies(apiMock);

      await expect(
        signTransaction({
          input: {
            derivationPath: DERIVATION_PATH,
            transaction: new Uint8Array(),
            curve: Curve.Secp256k1,
          },
        }),
      ).rejects.toMatchObject({
        _tag: "UnknownDAError",
        originalError: {
          message:
            "SignTransactionDeviceAction requires a non-empty serialized transaction (factory arg or invoke/context input)",
        },
      });
    });
  });
});
