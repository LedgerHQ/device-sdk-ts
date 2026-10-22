import {
  CommandResultFactory,
  DeviceActionStatus,
  type LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { SignTransactionDAStep } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Curve } from "@api/model/Curve";
import { XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

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

describe("SignTransactionDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signTransactionMock = vi.fn();

  const makeDeviceAction = () => {
    const deviceAction = new SignTransactionDeviceAction({
      input: {
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        skipOpenApp: true,
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

  it("signs using derivationPath and transaction from machine input", () =>
    new Promise<void>((resolve, reject) => {
      const deviceAction = makeDeviceAction();

      testDeviceActionStates(
        deviceAction,
        [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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
      const deviceAction = makeDeviceAction();

      testDeviceActionStates(
        deviceAction,
        [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
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
