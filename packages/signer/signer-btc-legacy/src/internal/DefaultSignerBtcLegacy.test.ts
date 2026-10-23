import {
  CallTaskInAppDeviceAction,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  InvalidStatusWordError,
  type LoggerPublisherService,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom } from "rxjs";

import { DOGECOIN_PROFILE } from "@api/profiles/dogecoinProfile";
import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { SignerBtcLegacyBuilder } from "@api/SignerBtcLegacyBuilder";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { REFERENCE_TRANSACTIONS } from "@internal/app-binder/task/__fixtures__/referenceTransactions";

describe("DefaultSignerBtcLegacy", () => {
  const logger = {} as LoggerPublisherService;
  const getLoggerFactory = () => () => logger;

  it("should get an address from the profile's app", () => {
    const sessionId = "session-id" as DeviceSessionId;
    const executeDeviceAction = vi.fn();
    const signer = new SignerBtcLegacyBuilder({
      dmk: {
        executeDeviceAction,
        getLoggerFactory,
      } as unknown as DeviceManagementKit,
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
        logger,
      }),
    });
  });

  it("should get an extended public key from the profile's app", () => {
    const executeDeviceAction = vi.fn();
    const signer = new SignerBtcLegacyBuilder({
      dmk: {
        executeDeviceAction,
        getLoggerFactory,
      } as unknown as DeviceManagementKit,
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
      dmk: {
        executeDeviceAction,
        getLoggerFactory,
      } as unknown as DeviceManagementKit,
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

  it("should sign a transaction in the profile's app", () => {
    const executeDeviceAction = vi.fn();
    const signer = new SignerBtcLegacyBuilder({
      dmk: {
        executeDeviceAction,
        getLoggerFactory,
      } as unknown as DeviceManagementKit,
      sessionId: "session-id" as DeviceSessionId,
      profile: DOGECOIN_PROFILE,
    }).build();

    signer.signTransaction(
      REFERENCE_TRANSACTIONS.find(
        ({ profile }) => profile === DOGECOIN_PROFILE,
      )!.transaction,
    );

    const { deviceAction } = executeDeviceAction.mock.calls[0]![0] as {
      deviceAction: CallTaskInAppDeviceAction<
        unknown,
        never,
        UserInteractionRequired
      >;
    };
    expect(deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
    expect(deviceAction.input).toMatchObject({
      appName: "Dogecoin",
      requiredUserInteraction: UserInteractionRequired.SignTransaction,
      skipOpenApp: false,
    });
  });
});
