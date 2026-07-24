import {
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
} from "@api/app-binder/GetAddressDeviceActionTypes";
import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";

import { DefaultSignerPolkadot } from "./DefaultSignerPolkadot";

describe("DefaultSignerPolkadot", () => {
  const sessionId = "test-session-id" as DeviceSessionId;
  const derivationPath = "44'/354'/0'/0'/0'";
  const ss58Prefix = 42;
  const mockLoggerFactory = () => ({});

  const makeDmkMock = (expectedResult: unknown) => {
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
      getLoggerFactory: vi.fn().mockReturnValue(mockLoggerFactory),
    } as unknown as DeviceManagementKit;
    return { executeDeviceActionMock, dmkMock };
  };

  it("getAddress should return the result from getAddressUseCase", () => {
    // ARRANGE
    const expectedResult: ExecuteDeviceActionReturnType<
      GetAddressDAOutput,
      GetAddressDAError,
      GetAddressDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: {
            publicKey: new Uint8Array([0x01, 0x02]),
            address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
          },
        },
      ]),
      cancel: vi.fn(),
    };
    const { executeDeviceActionMock, dmkMock } = makeDmkMock(expectedResult);
    const signer = new DefaultSignerPolkadot({ dmk: dmkMock, sessionId });

    // ACT
    const result = signer.getAddress(derivationPath, ss58Prefix);

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });

  it("signTransaction should return the result from signTransactionUseCase", () => {
    // ARRANGE
    const blob = new Uint8Array([0x01, 0x02]);
    const metadata = new Uint8Array([0x03, 0x04]);
    const expectedResult: ExecuteDeviceActionReturnType<
      SignTransactionDAOutput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: new Uint8Array([0x05, 0x06]),
        },
      ]),
      cancel: vi.fn(),
    };
    const { executeDeviceActionMock, dmkMock } = makeDmkMock(expectedResult);
    const signer = new DefaultSignerPolkadot({ dmk: dmkMock, sessionId });

    // ACT
    const result = signer.signTransaction(derivationPath, blob, metadata);

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });
});
