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
import { type ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  it("should call getAddress on appBinder with default options", () => {
    const derivationPath = "44'/133'/0'/0/0";
    const getAddressMock = vi.fn();
    const appBinder = {
      getAddress: getAddressMock,
    } as unknown as ZcashAppBinder;
    const expectedResult: ExecuteDeviceActionReturnType<
      GetAddressDAOutput,
      GetAddressDAError,
      GetAddressDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: {
            publicKey: new Uint8Array([0x01]),
            address: "t1Test",
            chainCode: new Uint8Array(32),
          },
        },
      ]),
      cancel: vi.fn(),
    };
    getAddressMock.mockReturnValue(expectedResult);

    const useCase = new GetAddressUseCase(appBinder);
    const result = useCase.execute(derivationPath);

    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: false,
      skipOpenApp: false,
    });
    expect(result).toBe(expectedResult);
  });

  it("should forward checkOnDevice and skipOpenApp from options", () => {
    const derivationPath = "44'/133'/1'/0/5";
    const getAddressMock = vi.fn().mockReturnValue({
      observable: from([]),
      cancel: vi.fn(),
    });
    const appBinder = {
      getAddress: getAddressMock,
    } as unknown as ZcashAppBinder;

    const useCase = new GetAddressUseCase(appBinder);
    useCase.execute(derivationPath, {
      checkOnDevice: true,
      skipOpenApp: true,
    });

    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: true,
      skipOpenApp: true,
    });
  });
});
