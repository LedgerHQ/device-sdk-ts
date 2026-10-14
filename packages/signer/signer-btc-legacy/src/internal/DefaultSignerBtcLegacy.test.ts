import {
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

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
});
