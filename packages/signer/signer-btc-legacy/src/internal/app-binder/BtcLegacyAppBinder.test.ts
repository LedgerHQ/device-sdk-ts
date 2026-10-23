import {
  CallTaskInAppDeviceAction,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  InvalidStatusWordError,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom } from "rxjs";

import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";

import { BtcLegacyAppBinder } from "./BtcLegacyAppBinder";

describe("BtcLegacyAppBinder", () => {
  const sessionId = "session-id" as DeviceSessionId;
  const executeDeviceAction = vi.fn();
  const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;

  beforeEach(() => {
    executeDeviceAction.mockReset();
  });

  describe("getAddress", () => {
    it("should send the get address command to the profile's app", () => {
      const binder = new BtcLegacyAppBinder(dmk, sessionId, LITECOIN_PROFILE);
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
      const binder = new BtcLegacyAppBinder(dmk, sessionId, LITECOIN_PROFILE);

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
      const binder = new BtcLegacyAppBinder(dmk, sessionId, LITECOIN_PROFILE);

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
      const binder = new BtcLegacyAppBinder(dmk, sessionId, LITECOIN_PROFILE);

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
});
