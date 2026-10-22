import {
  CallTaskInAppDeviceAction,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type InternalApi,
  InvalidStatusWordError,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom } from "rxjs";

import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { type BtcLegacyErrorCodes } from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { type SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";

import { BtcLegacyAppBinder } from "./BtcLegacyAppBinder";

describe("BtcLegacyAppBinder", () => {
  const sessionId = "session-id" as DeviceSessionId;
  const executeDeviceAction = vi.fn();
  const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;
  const run = vi.fn();
  const validate = vi.fn();
  const signTransactionTask = {
    run,
    validate,
  } as unknown as SignTransactionTask<BtcLegacyErrorCodes>;

  beforeEach(() => {
    executeDeviceAction.mockReset();
    run.mockReset();
    validate.mockReset();
  });

  describe("getAddress", () => {
    it("should send the get address command to the profile's app", () => {
      const binder = new BtcLegacyAppBinder(
        dmk,
        sessionId,
        LITECOIN_PROFILE,
        signTransactionTask,
      );
      const args = {
        derivationPath: "84'/2'/0'/0/0",
        checkOnDevice: false,
        skipOpenApp: false,
        addressFormat: "bech32" as const,
      };

      binder.getAddress(args);

      expect(executeDeviceAction).toHaveBeenCalledWith({
        sessionId,
        deviceAction: new SendCommandInAppDeviceAction({
          input: {
            command: new LegacyGetAddressCommand(args, LITECOIN_PROFILE.errors),
            appName: "Litecoin",
            requiredUserInteraction: UserInteractionRequired.None,
            skipOpenApp: false,
          },
        }),
      });
    });

    it("should require the address verification when checking on device", () => {
      const binder = new BtcLegacyAppBinder(
        dmk,
        sessionId,
        LITECOIN_PROFILE,
        signTransactionTask,
      );

      binder.getAddress({
        derivationPath: "84'/2'/0'/0/0",
        checkOnDevice: true,
        skipOpenApp: true,
      });

      const { deviceAction } = executeDeviceAction.mock.calls[0]![0] as {
        deviceAction: SendCommandInAppDeviceAction<
          unknown,
          unknown,
          string,
          UserInteractionRequired
        >;
      };
      expect(deviceAction.input.requiredUserInteraction).toBe(
        UserInteractionRequired.VerifyAddress,
      );
      expect(deviceAction.input.skipOpenApp).toBe(true);
    });
  });

  describe("getExtendedPublicKey", () => {
    it("should run the xpub task in the profile's app", () => {
      const binder = new BtcLegacyAppBinder(
        dmk,
        sessionId,
        LITECOIN_PROFILE,
        signTransactionTask,
      );

      binder.getExtendedPublicKey({
        derivationPath: "84'/2'/0'",
        skipOpenApp: false,
      });

      const { deviceAction } = executeDeviceAction.mock.calls[0]![0] as {
        deviceAction: CallTaskInAppDeviceAction<
          unknown,
          never,
          UserInteractionRequired
        >;
      };
      expect(deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
      expect(deviceAction.input).toMatchObject({
        appName: "Litecoin",
        requiredUserInteraction: UserInteractionRequired.None,
        skipOpenApp: false,
      });
    });

    it("should reject a path without a parent level before opening the app", async () => {
      const binder = new BtcLegacyAppBinder(
        dmk,
        sessionId,
        LITECOIN_PROFILE,
        signTransactionTask,
      );

      const { observable } = binder.getExtendedPublicKey({
        derivationPath: "84'",
        skipOpenApp: false,
      });

      await expect(lastValueFrom(observable)).resolves.toStrictEqual({
        status: DeviceActionStatus.Error,
        error: new InvalidStatusWordError(
          "The derivation path needs at least two levels",
        ),
      });
      expect(executeDeviceAction).not.toHaveBeenCalled();
    });
  });

  describe("signTransaction", () => {
    it("should run the signing task in the profile's app", async () => {
      const binder = new BtcLegacyAppBinder(
        dmk,
        sessionId,
        LITECOIN_PROFILE,
        signTransactionTask,
      );
      const transaction = {
        inputs: [],
        associatedKeysets: [],
        outputScriptHex: "00",
      };

      binder.signTransaction({ transaction, skipOpenApp: true });

      const { deviceAction } = executeDeviceAction.mock.calls[0]![0] as {
        deviceAction: CallTaskInAppDeviceAction<
          unknown,
          never,
          UserInteractionRequired
        >;
      };
      expect(deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
      expect(deviceAction.input).toMatchObject({
        appName: "Litecoin",
        requiredUserInteraction: UserInteractionRequired.SignTransaction,
        skipOpenApp: true,
      });

      const internalApi = {} as InternalApi;
      await deviceAction.input.task(internalApi);
      expect(run).toHaveBeenCalledWith(internalApi, transaction);
    });

    it("should reject invalid arguments before opening the app", async () => {
      const binder = new BtcLegacyAppBinder(
        dmk,
        sessionId,
        LITECOIN_PROFILE,
        signTransactionTask,
      );
      const transaction = {
        inputs: [],
        associatedKeysets: ["44'/2'/0'/0/0"],
        outputScriptHex: "00",
      };
      const error = new InvalidStatusWordError(
        "Inputs and associatedKeysets lengths mismatch",
      );
      validate.mockReturnValue(error);

      const { observable } = binder.signTransaction({
        transaction,
        skipOpenApp: false,
      });

      await expect(lastValueFrom(observable)).resolves.toStrictEqual({
        status: DeviceActionStatus.Error,
        error,
      });
      expect(validate).toHaveBeenCalledWith(transaction);
      expect(executeDeviceAction).not.toHaveBeenCalled();
    });
  });
});
