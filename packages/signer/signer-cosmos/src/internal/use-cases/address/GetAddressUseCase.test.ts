import {
  DeviceActionStatus,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
} from "@api/app-binder/GetAddressDeviceActionTypes";
import { type CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  it("should return the result from appBinder.getAddress", () => {
    // ARRANGE
    const derivationPath = "44'/118'/0'/0/0";
    const hrp = "cosmos";
    const getAddressMock = vi.fn();
    const appBinderMock = {
      getAddress: getAddressMock,
    } as unknown as CosmosAppBinder;
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
    getAddressMock.mockReturnValue(expectedResult);
    const getAddressUseCase = new GetAddressUseCase(appBinderMock);

    // ACT
    const result = getAddressUseCase.execute(derivationPath, hrp);

    // ASSERT
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      hrp,
      checkOnDevice: false,
      skipOpenApp: false,
    });
    expect(result).toEqual(expectedResult);
  });
});
