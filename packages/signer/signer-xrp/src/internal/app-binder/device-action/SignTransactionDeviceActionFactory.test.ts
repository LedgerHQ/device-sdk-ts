import {
  CommandResultFactory,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Just } from "purify-ts";

import { Curve } from "@api/model/Curve";
import { type SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";

import { SignTransactionDeviceActionFactory } from "./SignTransactionDeviceActionFactory";

const loggerFactory = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  }) as unknown as LoggerPublisherService;

describe("SignTransactionDeviceActionFactory", () => {
  const defaultArgs = {
    derivationPath: "44'/144'/0'/0/0",
    transaction: Uint8Array.from([0x12, 0x00, 0x00]),
    skipOpenApp: false,
    loggerFactory,
  };

  /** Run the sign dependency the factory built and return the Sign APDUs it sent. */
  const runBuiltSignDependency = async (
    deviceAction: SignTransactionDeviceAction,
  ) => {
    const sendCommand = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({ data: Just(Uint8Array.from([0x30, 0x44])) }),
      );

    const { signTransaction } = deviceAction.extractDependencies({
      sendCommand,
    } as unknown as InternalApi);

    await signTransaction({
      input: {
        derivationPath: deviceAction.input.derivationPath,
        transaction: deviceAction.input.transaction,
        curve: deviceAction.input.curve,
      },
    });

    return sendCommand.mock.calls.map(([command]) =>
      (command as SignTransactionCommand).getApdu().getRawApdu(),
    );
  };

  it("should create a SignTransactionDeviceAction", () => {
    const deviceAction = SignTransactionDeviceActionFactory(defaultArgs);

    expect(deviceAction).toBeInstanceOf(SignTransactionDeviceAction);
    expect(deviceAction.input.skipOpenApp).toBe(false);
    expect(deviceAction.input.curve).toBe(Curve.Secp256k1);
  });

  it("should forward skipOpenApp to the device action", () => {
    const deviceAction = SignTransactionDeviceActionFactory({
      ...defaultArgs,
      skipOpenApp: true,
    });

    expect(deviceAction.input.skipOpenApp).toBe(true);
  });

  it("should sign with secp256k1 when no curve is given", async () => {
    const deviceAction = SignTransactionDeviceActionFactory(defaultArgs);

    const apdus = await runBuiltSignDependency(deviceAction);

    expect(apdus).toHaveLength(1);
    expect(apdus[0]![3]).toBe(0x40);
  });

  it("should pass the curve through to the Sign APDU", async () => {
    const deviceAction = SignTransactionDeviceActionFactory({
      ...defaultArgs,
      curve: Curve.Ed25519,
    });

    const apdus = await runBuiltSignDependency(deviceAction);

    expect(apdus).toHaveLength(1);
    expect(apdus[0]![3]).toBe(0x80);
  });
});
