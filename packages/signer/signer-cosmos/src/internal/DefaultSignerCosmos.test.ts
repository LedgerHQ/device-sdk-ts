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
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
} from "@api/app-binder/GetAppConfigDeviceActionTypes";
import {
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";

import { DefaultSignerCosmos } from "./DefaultSignerCosmos";

describe("DefaultSignerCosmos", () => {
  const sessionId = "test-session-id" as DeviceSessionId;

  it("getAppConfig should return the result from getAppConfigUseCase", () => {
    // ARRANGE
    const expectedResult: ExecuteDeviceActionReturnType<
      GetAppConfigDAOutput,
      GetAppConfigDAError,
      GetAppConfigDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: {
            major: 1,
            minor: 2,
            patch: 3,
          },
        },
      ]),
      cancel: vi.fn(),
    };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerCosmos({ dmk: dmkMock, sessionId });

    // ACT
    const result = signer.getAppConfig();

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });

  it("getAddress should return the result from getAddressUseCase", () => {
    // ARRANGE
    const derivationPath = "44'/118'/0'/0/0";
    const hrp = "cosmos";
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
            address: "cosmos1234567890",
          },
        },
      ]),
      cancel: vi.fn(),
    };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerCosmos({ dmk: dmkMock, sessionId });

    // ACT
    const result = signer.getAddress(derivationPath, hrp);

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });

  it("signTransaction should return the result from signTransactionUseCase", () => {
    // ARRANGE
    const derivationPath = "44'/118'/0'/0/0";
    const hrp = "cosmos";
    const transaction = new Uint8Array([0x01, 0x02]);
    const expectedResult: ExecuteDeviceActionReturnType<
      SignTransactionDAOutput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: new Uint8Array([0x01, 0x02]),
        },
      ]),
      cancel: vi.fn(),
    };
    const executeDeviceActionMock = vi.fn().mockReturnValue(expectedResult);
    const dmkMock = {
      executeDeviceAction: executeDeviceActionMock,
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerCosmos({ dmk: dmkMock, sessionId });

    // ACT
    const result = signer.signTransaction(derivationPath, hrp, transaction);

    // ASSERT
    expect(executeDeviceActionMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedResult);
  });
});
