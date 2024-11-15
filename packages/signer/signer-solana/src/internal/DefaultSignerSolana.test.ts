import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerSolana } from "./DefaultSignerSolana";

describe("DefaultSignerSolana", () => {
  it("should be defined", () => {
    const signer = new DefaultSignerSolana({
      dmk: {} as DeviceManagementKit,
      sessionId: {} as DeviceSessionId,
    });
    expect(signer).toBeDefined();
  });

  it("should call getAddress", () => {
    const dmk = {
      executeDeviceAction: jest.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerSolana({ dmk, sessionId });
    signer.getAddress("derivationPath", {});
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call signTransaction", () => {
    const dmk = {
      executeDeviceAction: jest.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerSolana({ dmk, sessionId });
    signer.signTransaction("derivationPath", new Uint8Array(), {});
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call getAppConfiguration", () => {
    const dmk = {
      executeDeviceAction: jest.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerSolana({ dmk, sessionId });
    signer.getAppConfiguration();
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });
});
