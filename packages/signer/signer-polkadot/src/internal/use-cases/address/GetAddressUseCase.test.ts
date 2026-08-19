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
import { type PolkadotAppBinder } from "@internal/app-binder/PolkadotAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  const derivationPath = "44'/354'/0'/0'/0'";
  const ss58Prefix = 42;

  it("should return the result from appBinder.getAddress with default options", () => {
    // ARRANGE
    const getAddressMock = vi.fn();
    const appBinderMock = {
      getAddress: getAddressMock,
    } as unknown as PolkadotAppBinder;
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
    getAddressMock.mockReturnValue(expectedResult);
    const getAddressUseCase = new GetAddressUseCase(appBinderMock);

    // ACT
    const result = getAddressUseCase.execute(derivationPath, ss58Prefix);

    // ASSERT
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      ss58Prefix,
      checkOnDevice: false,
      skipOpenApp: false,
    });
    expect(result).toEqual(expectedResult);
  });

  it("should forward the checkOnDevice and skipOpenApp options", () => {
    // ARRANGE
    const getAddressMock = vi.fn();
    const appBinderMock = {
      getAddress: getAddressMock,
    } as unknown as PolkadotAppBinder;
    const getAddressUseCase = new GetAddressUseCase(appBinderMock);

    // ACT
    getAddressUseCase.execute(derivationPath, ss58Prefix, {
      checkOnDevice: true,
      skipOpenApp: true,
    });

    // ASSERT
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      ss58Prefix,
      checkOnDevice: true,
      skipOpenApp: true,
    });
  });
});
