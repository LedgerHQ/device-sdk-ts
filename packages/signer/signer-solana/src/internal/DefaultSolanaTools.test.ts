import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { DefaultSolanaTools } from "./DefaultSolanaTools";

describe("DefaultSolanaTools", () => {
  const contextModuleStub: ContextModule = {} as ContextModule;

  it("should be defined", () => {
    const solanaTools = new DefaultSolanaTools({
      dmk: {} as DeviceManagementKit,
      sessionId: {} as DeviceSessionId,
      contextModule: contextModuleStub,
    });
    expect(solanaTools).toBeDefined();
  });

  it("should call getAddress", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const solanaTools = new DefaultSolanaTools({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    solanaTools.getAddress("derivationPath", {});
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call getAppConfiguration", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const solanaTools = new DefaultSolanaTools({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    solanaTools.getAppConfiguration();
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call generateTransaction", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const solanaTools = new DefaultSolanaTools({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    solanaTools.generateTransaction("derivationPath");
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });

  it("should call swapTransaction", () => {
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const sessionId = {} as DeviceSessionId;
    const solanaTools = new DefaultSolanaTools({
      dmk,
      sessionId,
      contextModule: contextModuleStub,
    });
    solanaTools.swapTransactionSigner(
      "derivationPath",
      "serialisedTransaction",
    );
    expect(dmk.executeDeviceAction).toHaveBeenCalled();
  });
});
