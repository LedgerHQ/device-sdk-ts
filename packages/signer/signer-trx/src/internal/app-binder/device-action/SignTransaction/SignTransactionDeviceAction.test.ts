import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceActionStatus,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { SignTransactionDAStep } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { EMPTY_TRON_ADDRESS_BOOK } from "@api/model/TronAddressBook";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { testDeviceActionStates } from "@internal/app-binder/device-action/__test-utils__/testDeviceActionStates";

import { SignTransactionDeviceAction } from "./SignTransactionDeviceAction";

const DERIVATION_PATH = "44'/195'/0'/0/0";
const TRANSACTION = new Uint8Array([0x0a, 0x01, 0x00]);
const TOKEN_PAYLOAD = new Uint8Array([0xaa, 0xbb, 0xcc]);
const SIGNATURE = new Uint8Array([0xab, 0xcd]);
const APP_CONFIG: AppConfiguration = {
  version: "0.8.0",
  versionN: 800,
  allowData: true,
  allowContract: true,
  truncateAddress: false,
  signByHash: false,
};

describe("SignTransactionDeviceAction", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const getAppConfigMock = vi.fn();
  const buildContextMock = vi.fn();
  const provideContactMock = vi.fn();
  const signTransactionMock = vi.fn();

  const makeDeviceAction = () => {
    const deviceAction = new SignTransactionDeviceAction({
      input: {
        derivationPath: DERIVATION_PATH,
        transaction: TRANSACTION,
        contextModule: {} as ContextModule,
        addressBook: EMPTY_TRON_ADDRESS_BOOK,
        skipOpenApp: true,
      },
    });
    vi.spyOn(deviceAction, "extractDependencies").mockReturnValue({
      getAppConfig: getAppConfigMock,
      buildContext: buildContextMock,
      provideContact: provideContactMock,
      signTransaction: signTransactionMock,
    });
    return deviceAction;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getAppConfigMock.mockResolvedValue(
      CommandResultFactory({ data: APP_CONFIG }),
    );
    buildContextMock.mockResolvedValue([TOKEN_PAYLOAD]);
    provideContactMock.mockResolvedValue(undefined);
    signTransactionMock.mockResolvedValue(
      CommandResultFactory({ data: SIGNATURE }),
    );
  });

  it("builds the context before announcing the review, then signs", () =>
    new Promise<void>((resolve, reject) => {
      // GIVEN a transaction whose token name resolves
      const deviceAction = makeDeviceAction();

      // WHEN
      testDeviceActionStates(
        deviceAction,
        [
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
          },
          // THEN the review is announced only after the context is fetched
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
              step: SignTransactionDAStep.PROVIDE_CONTACT,
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
        ],
        apiMock,
        {
          onDone: () => {
            expect(provideContactMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  transaction: TRANSACTION,
                  appConfig: APP_CONFIG,
                },
              }),
            );
            expect(signTransactionMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: {
                  transaction: TRANSACTION,
                  tokenPayloads: [TOKEN_PAYLOAD],
                },
              }),
            );
            resolve();
          },
          onError: reject,
        },
      );
    }));

  it("signs when app configuration cannot be read", () =>
    new Promise<void>((resolve, reject) => {
      getAppConfigMock.mockRejectedValue(new Error("unsupported"));

      testDeviceActionStates(
        makeDeviceAction(),
        [
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
              step: SignTransactionDAStep.PROVIDE_CONTACT,
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
        ],
        apiMock,
        {
          onDone: () => {
            expect(provideContactMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: { transaction: TRANSACTION, appConfig: null },
              }),
            );
            resolve();
          },
          onError: reject,
        },
      );
    }));

  it("signs when contact provisioning throws", () =>
    new Promise<void>((resolve, reject) => {
      provideContactMock.mockRejectedValue(new Error("rejected"));

      testDeviceActionStates(
        makeDeviceAction(),
        [
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
              step: SignTransactionDAStep.PROVIDE_CONTACT,
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
        ],
        apiMock,
        { onDone: resolve, onError: reject },
      );
    }));

  it("signs without a token name when building the context throws", () =>
    new Promise<void>((resolve, reject) => {
      // GIVEN a host-side failure while resolving the token name
      buildContextMock.mockRejectedValue(new Error("boom"));

      // WHEN
      testDeviceActionStates(
        makeDeviceAction(),
        [
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
              step: SignTransactionDAStep.PROVIDE_CONTACT,
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
        ],
        apiMock,
        {
          // THEN the transaction is still signed, without a token name
          onDone: () => {
            expect(signTransactionMock).toHaveBeenCalledWith(
              expect.objectContaining({
                input: { transaction: TRANSACTION, tokenPayloads: [] },
              }),
            );
            resolve();
          },
          onError: reject,
        },
      );
    }));

  it("reports the device error when signing fails", () =>
    new Promise<void>((resolve, reject) => {
      // GIVEN the device refuses the transaction
      const error = new UnknownDAError("rejected");
      signTransactionMock.mockResolvedValue(
        CommandResultFactory({ error: error as never }),
      );

      // WHEN
      testDeviceActionStates(
        makeDeviceAction(),
        [
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
              step: SignTransactionDAStep.PROVIDE_CONTACT,
            },
          },
          {
            status: DeviceActionStatus.Pending,
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
          },
          { status: DeviceActionStatus.Error, error },
        ],
        apiMock,
        { onDone: resolve, onError: reject },
      );
    }));
});
