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
import { SignerBtcLegacyBuilder } from "@api/SignerBtcLegacyBuilder";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";

describe("DefaultSignerBtcLegacy", () => {
  it("should get an address from the profile's app", () => {
    const sessionId = "session-id" as DeviceSessionId;
    const executeDeviceAction = vi.fn();
    const signer = new SignerBtcLegacyBuilder({
      dmk: { executeDeviceAction } as unknown as DeviceManagementKit,
      sessionId,
      profile: LITECOIN_PROFILE,
    }).build();

    signer.getAddress("49'/2'/0'/0/0", {
      checkOnDevice: true,
      addressFormat: "p2sh",
    });

    const binderArgs = {
      derivationPath: "49'/2'/0'/0/0",
      checkOnDevice: true,
      skipOpenApp: false,
      addressFormat: "p2sh" as const,
    };
    expect(executeDeviceAction).toHaveBeenCalledWith({
      sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new LegacyGetAddressCommand(
            binderArgs,
            LITECOIN_PROFILE.errors,
          ),
          appName: "Litecoin",
          requiredUserInteraction: UserInteractionRequired.VerifyAddress,
          skipOpenApp: false,
        },
      }),
    });
  });

  it("should get an extended public key from the profile's app", () => {
    const executeDeviceAction = vi.fn();
    const signer = new SignerBtcLegacyBuilder({
      dmk: { executeDeviceAction } as unknown as DeviceManagementKit,
      sessionId: "session-id" as DeviceSessionId,
      profile: LITECOIN_PROFILE,
    }).build();

    signer.getExtendedPublicKey("84'/2'/0'", { skipOpenApp: true });

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
      skipOpenApp: true,
    });
  });

  it("should reject a path without a parent level before any device action", async () => {
    const executeDeviceAction = vi.fn();
    const signer = new SignerBtcLegacyBuilder({
      dmk: { executeDeviceAction } as unknown as DeviceManagementKit,
      sessionId: "session-id" as DeviceSessionId,
      profile: LITECOIN_PROFILE,
    }).build();

    const { observable } = signer.getExtendedPublicKey("84'");

    await expect(lastValueFrom(observable)).resolves.toStrictEqual({
      status: DeviceActionStatus.Error,
      error: new InvalidStatusWordError(
        "The derivation path needs at least two levels",
      ),
    });
    expect(executeDeviceAction).not.toHaveBeenCalled();
  });
});
