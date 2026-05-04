import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { DefaultSignerZcash } from "./DefaultSignerZcash";

describe("DefaultSignerZcash", () => {
  it("should be defined", () => {
    const signer = new DefaultSignerZcash({
      dmk: {} as DeviceManagementKit,
      sessionId: {} as DeviceSessionId,
    });
    expect(signer).toBeDefined();
  });

  it("should call getAddress via device action", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerZcash({ dmk, sessionId });

    signer.getAddress("44'/133'/0'/0/0", {});

    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call getFullViewingKey via device action", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerZcash({ dmk, sessionId });

    signer.getFullViewingKey("44'/133'/0'/0/0", {});

    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });
});
