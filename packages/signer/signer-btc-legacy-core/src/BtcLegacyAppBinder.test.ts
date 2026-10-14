import "reflect-metadata";

import {
  type Command,
  type CommandErrorArgs,
  DeviceExchangeError,
  type DeviceManagementKit,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { type BtcLegacyAppBinder } from "./BtcLegacyAppBinder";
import { btcLegacyTypes } from "./btcLegacyTypes";
import { btcLegacyModuleFactory } from "./di";
import { type LegacyCoinProfile } from "./profile";

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

describe("btcLegacyModuleFactory", () => {
  it("gives an app binder that sends get address to the profile's app", () => {
    const executeDeviceAction = vi.fn().mockReturnValue({});
    const container = new Container();
    container.bind(btcLegacyTypes.Dmk).toConstantValue({
      executeDeviceAction,
    } as unknown as DeviceManagementKit);
    container.bind(btcLegacyTypes.SessionId).toConstantValue("session");
    container.bind(btcLegacyTypes.Profile).toConstantValue(litecoin);
    container.loadSync(btcLegacyModuleFactory());

    container
      .get<BtcLegacyAppBinder<"6985">>(btcLegacyTypes.AppBinder)
      .getAddress({
        derivationPath: "84'/2'/0'/0/0",
        checkOnDevice: true,
        skipOpenApp: false,
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
    expect(deviceAction.input.appName).toBe("Litecoin");
    expect(deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.VerifyAddress,
    );
    expect(
      Buffer.from(deviceAction.input.command.getApdu().getRawApdu()).toString(
        "hex",
      ),
    ).toBe(
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
    const refused = deviceAction.input.command.parseResponse({
      statusCode: Uint8Array.of(0x69, 0x85),
      data: new Uint8Array(),
    }) as { error?: unknown };
    expect(refused.error).toBeInstanceOf(LitecoinError);
  });
});
