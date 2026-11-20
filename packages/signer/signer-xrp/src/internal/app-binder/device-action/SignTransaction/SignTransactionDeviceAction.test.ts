/* eslint @typescript-eslint/consistent-type-imports: 0 */
import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  hexaStringToBuffer,
  type LoggerPublisherService,
  OpenAppDeviceAction,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { type Mock } from "vitest";
import { assign, createMachine } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Curve } from "@api/model/Curve";
import { XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";
import { type MptContext } from "@internal/app-binder/task/BuildMptContextTask";

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
const MPT_PAYMENT = hexaStringToBuffer(
  "120000616000000000000004D2000000050511E17DB83BB6F113939D67BC8EA539EDC926FC",
)!;
const SIGNATURE = new Uint8Array([0x30, 0x44]);

const xrpSession = (version: string) => ({
  sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
  deviceStatus: DeviceStatus.CONNECTED,
  installedApps: [],
  currentApp: { name: "XRP", version },
  deviceModelId: DeviceModelId.STAX,
  isSecureConnectionAllowed: true,
});

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
  const getAppConfigMock = vi.fn();
  const buildContextMock = vi.fn();
  const provideContextMock = vi.fn();
  const signTransactionMock = vi.fn();
  const contextModule = { getContexts: vi.fn() } as unknown as ContextModule;
  const MPT_CONTEXTS: MptContext[] = [
    { type: ClearSignContextType.XRP_MPT, payload: "0101900801aa" },
  ];

  const makeDeviceAction = (
    skipOpenApp: boolean,
    transaction: Uint8Array = TRANSACTION,
  ) => {
    const deviceAction = new SignTransactionDeviceAction({
      input: {
        derivationPath: DERIVATION_PATH,
        transaction,
        skipOpenApp,
        curve: Curve.Secp256k1,
        contextModule,
        loggerFactory,
      },
    });
    vi.spyOn(deviceAction, "extractDependencies").mockReturnValue({
      getAppConfig: getAppConfigMock,
      buildContext: buildContextMock,
      provideContext: provideContextMock,
      signTransaction: signTransactionMock,
    });
    return deviceAction;
  };

  const contextSteps: DeviceActionState<
    SignTransactionDAOutput,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue
  >[] = [
    {
      status: DeviceActionStatus.Pending,
      intermediateValue: {
        requiredUserInteraction: UserInteractionRequired.None,
        step: SignTransactionDAStep.GET_APP_CONFIG,
      },
    },
    {
      status: DeviceActionStatus.Pending,
      intermediateValue: {
        requiredUserInteraction: UserInteractionRequired.None,
        step: SignTransactionDAStep.BUILD_CONTEXT,
      },
    },
    {
      status: DeviceActionStatus.Pending,
      intermediateValue: {
        requiredUserInteraction: UserInteractionRequired.None,
        step: SignTransactionDAStep.PROVIDE_CONTEXT,
      },
    },
    {
      status: DeviceActionStatus.Pending,
      intermediateValue: {
        requiredUserInteraction: UserInteractionRequired.SignTransaction,
        step: SignTransactionDAStep.SIGN_TRANSACTION,
      },
    },
    { status: DeviceActionStatus.Completed, output: SIGNATURE },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getDeviceSessionState.mockReturnValue(xrpSession("2.9.0"));
    getAppConfigMock.mockResolvedValue(
      CommandResultFactory({ data: { version: "2.9.0" } }),
    );
    buildContextMock.mockResolvedValue(MPT_CONTEXTS);
    provideContextMock.mockResolvedValue(undefined);
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
            ...contextSteps.slice(0, 3),
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
            ...contextSteps.slice(0, 3),
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
            ...contextSteps.slice(0, 3),
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

  describe("context", () => {
    it("provides the MPT descriptors before signing", () =>
      new Promise<void>((resolve, reject) => {
        testDeviceActionStates(makeDeviceAction(true), contextSteps, apiMock, {
          onDone: () => {
            expect(buildContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  contextModule,
                  transaction: TRANSACTION,
                },
              }),
            );
            expect(provideContextMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: { contexts: MPT_CONTEXTS },
              }),
            );
            expect(signTransactionMock).toHaveBeenCalledTimes(1);
            resolve();
          },
          onError: reject,
        });
      }));

    it.each([
      ["the app is older than 2.9.0", "2.7.0"],
      ["the app config cannot be read", null],
    ])(
      "signs without the context steps when %s",
      (_label, version) =>
        new Promise<void>((resolve, reject) => {
          apiMock.getDeviceSessionState.mockReturnValue(
            xrpSession(version ?? "2.7.0"),
          );
          getAppConfigMock.mockImplementation(() =>
            version === null
              ? Promise.reject(new Error("transport"))
              : Promise.resolve(CommandResultFactory({ data: { version } })),
          );

          testDeviceActionStates(
            makeDeviceAction(true, MPT_PAYMENT),
            [contextSteps[0]!, contextSteps[3]!, contextSteps[4]!],
            apiMock,
            {
              onDone: () => {
                expect(buildContextMock).not.toHaveBeenCalled();
                expect(provideContextMock).not.toHaveBeenCalled();
                expect(signTransactionMock).toHaveBeenCalledTimes(1);
                resolve();
              },
              onError: reject,
            },
          );
        }),
    );

    it("signs without descriptors when building the context fails", () =>
      new Promise<void>((resolve, reject) => {
        buildContextMock.mockRejectedValue(new Error("CAL down"));

        testDeviceActionStates(
          makeDeviceAction(true),
          [
            contextSteps[0]!,
            contextSteps[1]!,
            contextSteps[3]!,
            contextSteps[4]!,
          ],
          apiMock,
          {
            onDone: () => {
              expect(provideContextMock).not.toHaveBeenCalled();
              expect(signTransactionMock).toHaveBeenCalledTimes(1);
              resolve();
            },
            onError: reject,
          },
        );
      }));

    it("signs when providing the context fails", () =>
      new Promise<void>((resolve, reject) => {
        provideContextMock.mockRejectedValue(new Error("6a80"));

        testDeviceActionStates(makeDeviceAction(true), contextSteps, apiMock, {
          onDone: () => {
            expect(signTransactionMock).toHaveBeenCalledTimes(1);
            resolve();
          },
          onError: reject,
        });
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
          contextModule,
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
