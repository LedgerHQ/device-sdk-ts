import {
  DeviceActionStatus,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetShieldedAddressDAError,
  type GetShieldedAddressDAIntermediateValue,
  type GetShieldedAddressDAOutput,
} from "@api/app-binder/GetShieldedAddressDeviceActionTypes";
import { type ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

import { GetShieldedAddressUseCase } from "./GetShieldedAddressUseCase";

describe("GetShieldedAddressUseCase", () => {
  const derivationPath = "44'/133'/0'/0/0";

  const makeAppBinder = () => {
    const getShieldedAddress = vi.fn();
    return {
      appBinder: { getShieldedAddress } as unknown as ZcashAppBinder,
      getShieldedAddress,
    };
  };

  const expectedResult: ExecuteDeviceActionReturnType<
    GetShieldedAddressDAOutput,
    GetShieldedAddressDAError,
    GetShieldedAddressDAIntermediateValue
  > = {
    observable: from([
      {
        status: DeviceActionStatus.Completed as const,
        output: { address: "u17qxnge3fpth2w43cfvz3lezxkevzmh5lpl5j4vlkfclpxdz9rx2fmml98wmwq3268yld6exrhyg29k2xhrnt4rldxva96qe8uwf7qc9" },
      },
    ]),
    cancel: vi.fn(),
  };

  it("should call getShieldedAddress with default options", () => {
    const { appBinder, getShieldedAddress } = makeAppBinder();
    getShieldedAddress.mockReturnValue(expectedResult);

    const useCase = new GetShieldedAddressUseCase(appBinder);
    const result = useCase.execute(derivationPath);

    expect(getShieldedAddress).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: false,
      skipOpenApp: false,
    });
    expect(result).toBe(expectedResult);
  });

  it("should forward checkOnDevice and skipOpenApp from options", () => {
    const { appBinder, getShieldedAddress } = makeAppBinder();
    getShieldedAddress.mockReturnValue(expectedResult);

    const useCase = new GetShieldedAddressUseCase(appBinder);
    useCase.execute(derivationPath, { checkOnDevice: true, skipOpenApp: true });

    expect(getShieldedAddress).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: true,
      skipOpenApp: true,
    });
  });
});
