import {
  DeviceActionStatus,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";
import { vi } from "vitest";

import {
  type GetFullViewingKeyDAError,
  type GetFullViewingKeyDAIntermediateValue,
  type GetFullViewingKeyDAOutput,
} from "@api/app-binder/GetFullViewingKeyDeviceActionTypes";
import { type ZcashAppBinder } from "@internal/app-binder/ZcashAppBinder";

import { GetFullViewingKeyUseCase } from "./GetFullViewingKeyUseCase";

describe("GetFullViewingKeyUseCase", () => {
  it("should call getFullViewingKey on appBinder with default options", () => {
    const derivationPath = "44'/133'/0'/0/0";
    const getFullViewingKey = vi.fn();
    const appBinder = {
      getFullViewingKey,
    } as unknown as ZcashAppBinder;
    const expectedResult: ExecuteDeviceActionReturnType<
      GetFullViewingKeyDAOutput,
      GetFullViewingKeyDAError,
      GetFullViewingKeyDAIntermediateValue
    > = {
      observable: from([
        {
          status: DeviceActionStatus.Completed as const,
          output: { mode: "ufvk" as const, fullViewingKey: "uview" },
        },
      ]),
      cancel: vi.fn(),
    };
    getFullViewingKey.mockReturnValue(expectedResult);

    const useCase = new GetFullViewingKeyUseCase(appBinder);
    const result = useCase.execute(derivationPath);

    expect(getFullViewingKey).toHaveBeenCalledWith({
      derivationPath,
      mode: "ufvk",
      skipOpenApp: false,
    });
    expect(result).toBe(expectedResult);
  });

  it("should forward mode and skipOpenApp from options", () => {
    const getFullViewingKey = vi.fn().mockReturnValue({
      observable: from([]),
      cancel: vi.fn(),
    });
    const appBinder = {
      getFullViewingKey,
    } as unknown as ZcashAppBinder;
    const useCase = new GetFullViewingKeyUseCase(appBinder);
    useCase.execute("44'/133'/0'/0/0", {
      mode: "orchardFvk",
      skipOpenApp: true,
    });
    expect(getFullViewingKey).toHaveBeenCalledWith({
      derivationPath: "44'/133'/0'/0/0",
      mode: "orchardFvk",
      skipOpenApp: true,
    });
  });
});
