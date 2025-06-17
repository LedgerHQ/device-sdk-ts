import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { DefaultSignerSolana } from "./DefaultSignerSolana";

describe("DefaultSignerSolana", () => {
  const contextModuleStub: ContextModule = {} as ContextModule;

  it("should be defined", () => {
    const signer = new DefaultSignerSolana({
      dmk: {} as DeviceManagementKit,
      sessionId: {} as DeviceSessionId,
      contextModule: contextModuleStub,
    });
    expect(signer).toBeDefined();
  });

  it("should call getAddress", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerSolana({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    signer.getAddress("derivationPath", {});
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call signTransaction", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerSolana({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    signer.signTransaction("derivationPath", new Uint8Array());
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call signMessage", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerSolana({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    signer.signMessage("44'/501'/0'/0'", "Hello world");
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call getAppConfiguration", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerSolana({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    signer.getAppConfiguration();
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });
});
