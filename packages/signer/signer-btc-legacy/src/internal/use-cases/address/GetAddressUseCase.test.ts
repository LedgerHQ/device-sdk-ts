import { type BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  const getAddress = vi.fn();
  const appBinder = { getAddress } as unknown as BtcLegacyAppBinder<string>;

  beforeEach(() => {
    getAddress.mockReset();
  });

  it("should call the app binder with the default options", () => {
    const expected = Symbol("result");
    getAddress.mockReturnValue(expected);

    const result = new GetAddressUseCase(appBinder).execute("84'/2'/0'/0/0");

    expect(getAddress).toHaveBeenCalledWith({
      derivationPath: "84'/2'/0'/0/0",
      checkOnDevice: false,
      skipOpenApp: false,
      addressFormat: undefined,
    });
    expect(result).toBe(expected);
  });

  it("should forward the options", () => {
    new GetAddressUseCase(appBinder).execute("49'/2'/0'/0/0", {
      checkOnDevice: true,
      skipOpenApp: true,
      addressFormat: "p2sh",
    });

    expect(getAddress).toHaveBeenCalledWith({
      derivationPath: "49'/2'/0'/0/0",
      checkOnDevice: true,
      skipOpenApp: true,
      addressFormat: "p2sh",
    });
  });
});
