import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { DefaultSignerHedera } from "./DefaultSignerHedera";

describe("DefaultSignerHedera", () => {
  const sessionId = "test-session-id" as DeviceSessionId;

  const makeSigner = (executeDeviceActionMock: ReturnType<typeof vi.fn>) => {
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    return new DefaultSignerHedera({ dmk: dmkMock, sessionId });
  };

  it("getAppConfig should delegate to the app config device action", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const signer = makeSigner(executeDeviceActionMock);

    // ACT
    const result = signer.getAppConfig();

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });

  it("getPublicKey should delegate to the public key device action", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const signer = makeSigner(executeDeviceActionMock);

    // ACT
    const result = signer.getPublicKey(0);

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });

  it("signTransaction should delegate to the transaction device action", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const signer = makeSigner(executeDeviceActionMock);

    // ACT
    const result = signer.signTransaction(0, new Uint8Array([0x01, 0x02]));

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });
});
