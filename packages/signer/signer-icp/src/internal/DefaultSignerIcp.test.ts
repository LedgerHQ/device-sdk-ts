import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { DefaultSignerIcp } from "./DefaultSignerIcp";

describe("DefaultSignerIcp", () => {
  const sessionId = "test-session-id" as DeviceSessionId;
  const mockLoggerFactory = () => ({});

  const makeSigner = (executeDeviceActionMock: ReturnType<typeof vi.fn>) => {
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
      getLoggerFactory: vi.fn().mockReturnValue(mockLoggerFactory),
    } as unknown as DeviceManagementKit;
    return new DefaultSignerIcp({ dmk: dmkMock, sessionId });
  };

  it("getAppConfiguration should delegate to the version device action", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const signer = makeSigner(executeDeviceActionMock);

    // ACT
    const result = signer.getAppConfiguration();

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });

  it("getAddress should delegate to the address device action", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const signer = makeSigner(executeDeviceActionMock);

    // ACT
    const result = signer.getAddress("44'/223'/0'/0/0");

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
    const result = signer.signTransaction(
      "44'/223'/0'/0/0",
      new Uint8Array([0x01, 0x02]),
    );

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });
});
