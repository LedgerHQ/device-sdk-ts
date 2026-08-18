import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";

import { DefaultContactsManager } from "./DefaultContactsManager";

const VALID_INPUT: RegisterExternalAddressInput = {
  contactName: "Alice",
  scope: "Eth main",
  identifier: new Uint8Array(20).fill(0x11),
  blockchainFamily: "ethereum",
  chainId: 1n,
};

describe("DefaultContactsManager", () => {
  it("registerExternalAddress flows manager -> use-case -> binder -> dmk.executeDeviceAction", () => {
    const executeDeviceAction = vi.fn().mockReturnValue("DA_RETURN");
    const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;

    const manager = new DefaultContactsManager({
      dmk,
      sessionId: "session-id",
      appName: "Ethereum",
    });

    const result = manager.registerExternalAddress(VALID_INPUT);

    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
    const call = executeDeviceAction.mock.calls[0]![0] as {
      sessionId: string;
      deviceAction: unknown;
    };
    expect(call.sessionId).toBe("session-id");
    expect(call.deviceAction).toBeDefined();
    expect(result).toBe("DA_RETURN");
  });

  it("does not throw on invalid input — it dispatches the device action, which surfaces the error", () => {
    // The public API returns a device action; invalid caller input must reach
    // the observable as a typed error state rather than throwing synchronously.
    const executeDeviceAction = vi.fn().mockReturnValue("DA_RETURN");
    const dmk = { executeDeviceAction } as unknown as DeviceManagementKit;

    const manager = new DefaultContactsManager({
      dmk,
      sessionId: "session-id",
      appName: "Ethereum",
    });

    expect(() =>
      manager.registerExternalAddress({
        ...VALID_INPUT,
        contactName: "",
      }),
    ).not.toThrow();
    expect(executeDeviceAction).toHaveBeenCalledTimes(1);
  });
});
