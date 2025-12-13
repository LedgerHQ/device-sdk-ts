import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { DefaultSignerCosmos } from "@internal/DefaultSignerCosmos";

describe("DefaultSignerCosmos", () => {
  const contextModuleStub: ContextModule = {} as ContextModule;

  it("should be defined", () => {
    const signer = new DefaultSignerCosmos({
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
    const signer = new DefaultSignerCosmos({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    signer.getAddress("derivationPath", "cosmos", {});
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call signTransaction", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const signer = new DefaultSignerCosmos({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    signer.signTransaction("derivationPath", new Uint8Array());
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });
});
