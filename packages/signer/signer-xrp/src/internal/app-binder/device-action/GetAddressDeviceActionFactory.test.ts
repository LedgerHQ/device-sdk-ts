import {
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { APP_NAME } from "@internal/app-binder/constants";

import { GetAddressDeviceActionFactory } from "./GetAddressDeviceActionFactory";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    SendCommandInAppDeviceAction: vi.fn(),
  };
});

describe("GetAddressDeviceActionFactory", () => {
  const defaultArgs = {
    derivationPath: "44'/144'/0'/0/0",
    checkOnDevice: false,
    returnChainCode: false,
    skipOpenApp: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      desc: "checkOnDevice is false",
      overrides: { checkOnDevice: false },
      expectedInteraction: UserInteractionRequired.None,
    },
    {
      desc: "checkOnDevice is true",
      overrides: { checkOnDevice: true },
      expectedInteraction: UserInteractionRequired.VerifyAddress,
    },
  ])(
    "should use $expectedInteraction interaction when $desc",
    ({ overrides, expectedInteraction }) => {
      GetAddressDeviceActionFactory({ ...defaultArgs, ...overrides });

      expect(SendCommandInAppDeviceAction).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        input: expect.objectContaining({
          appName: APP_NAME,
          requiredUserInteraction: expectedInteraction,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          command: expect.any(GetAddressCommand),
        }),
      });
    },
  );

  it("should forward skipOpenApp to the device action", () => {
    GetAddressDeviceActionFactory({ ...defaultArgs, skipOpenApp: true });

    expect(SendCommandInAppDeviceAction).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      input: expect.objectContaining({
        skipOpenApp: true,
      }),
    });
  });

  it("should pass the command arguments through to the command", () => {
    GetAddressDeviceActionFactory({
      ...defaultArgs,
      checkOnDevice: true,
      returnChainCode: true,
    });

    const { input } = vi.mocked(SendCommandInAppDeviceAction).mock
      .calls[0]![0] as unknown as {
      input: { command: GetAddressCommand };
    };

    // P1 display-and-confirm, P2 secp256k1 | return chain code.
    const apdu = input.command.getApdu().getRawApdu();
    expect(apdu[2]).toBe(0x01);
    expect(apdu[3]).toBe(0x41);
  });
});
