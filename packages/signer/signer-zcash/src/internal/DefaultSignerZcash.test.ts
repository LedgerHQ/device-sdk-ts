import {
  CallTaskInAppDeviceAction,
  CommandResultFactory,
  type DeviceManagementKit,
  type DeviceSessionId,
  type DmkError,
  type InternalApi,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import {
  GetFullViewingKeyCommand,
  zcashFvkP2FromMode,
} from "@internal/app-binder/command/GetFullViewingKeyCommand";
import { APP_NAME } from "@internal/app-binder/constants";

import { DefaultSignerZcash } from "./DefaultSignerZcash";

describe("DefaultSignerZcash", () => {
  it("should be defined", () => {
    const signer = new DefaultSignerZcash({
      dmk: {} as DeviceManagementKit,
      sessionId: {} as DeviceSessionId,
    });
    expect(signer).toBeDefined();
  });

  it("should call getAddress via device action with derivation path and defaults", () => {
    const sessionId = "test-session-id" as DeviceSessionId;
    const derivationPath = "44'/133'/0'/0/0";
    const executeDeviceAction = vi.fn().mockReturnValue({
      observable: from([]),
      cancel: vi.fn(),
    });
    const dmk = {
      executeDeviceAction,
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerZcash({ dmk, sessionId });

    signer.getAddress(derivationPath, {});

    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    const call = executeDeviceAction.mock.calls[0]![0] as {
      sessionId: DeviceSessionId;
      deviceAction: {
        input: {
          command: GetAddressCommand;
          appName: string;
          requiredUserInteraction: UserInteractionRequired;
          skipOpenApp: boolean;
        };
      };
    };
    expect(call.sessionId).toBe(sessionId);
    expect(call.deviceAction).toBeInstanceOf(SendCommandInAppDeviceAction);
    expect(call.deviceAction.input.command).toBeInstanceOf(GetAddressCommand);
    expect(call.deviceAction.input.appName).toBe(APP_NAME);
    expect(call.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
    expect(call.deviceAction.input.skipOpenApp).toBe(false);
    expect(call.deviceAction.input.command.getApdu()).toEqual(
      new GetAddressCommand({
        derivationPath,
        checkOnDevice: false,
      }).getApdu(),
    );
  });

  it("should call getFullViewingKey via device action with derivation path and default UFVK mode", async () => {
    const sessionId = "test-session-id" as DeviceSessionId;
    const derivationPath = "44'/133'/0'/0/0";
    const ufvkPayload = new Uint8Array([0, 0]);
    const executeDeviceAction = vi.fn().mockReturnValue({
      observable: from([]),
      cancel: vi.fn(),
    });
    const dmk = {
      executeDeviceAction,
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerZcash({ dmk, sessionId });

    signer.getFullViewingKey(derivationPath, {});

    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    const call = executeDeviceAction.mock.calls[0]![0] as {
      sessionId: DeviceSessionId;
      deviceAction: CallTaskInAppDeviceAction<
        unknown,
        DmkError,
        UserInteractionRequired.None
      >;
    };
    expect(call.sessionId).toBe(sessionId);
    expect(call.deviceAction).toBeInstanceOf(CallTaskInAppDeviceAction);
    expect(call.deviceAction.input.appName).toBe(APP_NAME);
    expect(call.deviceAction.input.requiredUserInteraction).toBe(
      UserInteractionRequired.None,
    );
    expect(call.deviceAction.input.skipOpenApp).toBe(false);

    const sendCommand = vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: { data: ufvkPayload } }));
    await call.deviceAction.input.task({
      sendCommand,
    } as unknown as InternalApi);

    const firstCommand = sendCommand.mock
      .calls[0]![0] as GetFullViewingKeyCommand;
    expect(firstCommand.getApdu()).toEqual(
      new GetFullViewingKeyCommand({
        isContinue: false,
        derivationPath,
        p2: zcashFvkP2FromMode("ufvk"),
      }).getApdu(),
    );
  });
});
