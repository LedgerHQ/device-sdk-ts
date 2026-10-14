import {
  type Command,
  type CommandErrorArgs,
  DeviceExchangeError,
  type DeviceManagementKit,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type LegacyCoinProfile } from "@ledgerhq/signer-btc-legacy-core";

import { SignerBtcLegacyBuilder } from "@api/SignerBtcLegacyBuilder";

class LitecoinError extends DeviceExchangeError<"6985"> {
  constructor(args: CommandErrorArgs<"6985">) {
    super({ tag: "LitecoinAppCommandError", ...args });
  }
}

const litecoin: LegacyCoinProfile<"6985"> = {
  appName: "Litecoin",
  errors: {
    errors: { "6985": { message: "UserRejectedError" } },
    factory: (args) => new LitecoinError(args),
  },
  newTransactionP2: 0x02,
};

describe("SignerBtcLegacy", () => {
  it("sends get address to the profile's app, with its error map", () => {
    const executeDeviceAction = vi.fn().mockReturnValue({});
    const signer = new SignerBtcLegacyBuilder({
      dmk: { executeDeviceAction } as unknown as DeviceManagementKit,
      sessionId: "session",
      profile: litecoin,
    }).build();

    signer.getAddress("84'/2'/0'/0/0", {
      checkOnDevice: true,
      addressFormat: 0x02,
    });

    const { deviceAction } = executeDeviceAction.mock.calls[0]![0] as {
      deviceAction: {
        input: {
          appName: string;
          requiredUserInteraction: UserInteractionRequired;
          command: Command<unknown, unknown, "6985">;
        };
      };
    };
    expect(deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(deviceAction.input.appName).toBe("Litecoin");
    expect(deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.VerifyAddress,
    );
    const command = deviceAction.input.command;
    expect(Buffer.from(command.getApdu().getRawApdu()).toString("hex")).toBe(
      // CLA INS P1=verify P2=bech32 Lc | 5 path elements: 84' 2' 0' 0 0
      "e0400102" +
        "15" +
        "05" +
        "80000054" +
        "80000002" +
        "80000000" +
        "00000000" +
        "00000000",
    );
    const refused = command.parseResponse({
      statusCode: Uint8Array.of(0x69, 0x85),
      data: new Uint8Array(),
    }) as { error?: DeviceExchangeError<"6985"> };
    expect(refused.error).toBeInstanceOf(LitecoinError);
  });
});
