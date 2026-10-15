import { type BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";

import { GetExtendedPublicKeyUseCase } from "./GetExtendedPublicKeyUseCase";

describe("GetExtendedPublicKeyUseCase", () => {
  const getExtendedPublicKey = vi.fn();
  const appBinder = {
    getExtendedPublicKey,
  } as unknown as BtcLegacyAppBinder<string>;

  beforeEach(() => {
    getExtendedPublicKey.mockReset();
  });

  it("should call the app binder with the default options", () => {
    const expected = Symbol("result");
    getExtendedPublicKey.mockReturnValue(expected);

    const result = new GetExtendedPublicKeyUseCase(appBinder).execute(
      "84'/2'/0'",
    );

    expect(getExtendedPublicKey).toHaveBeenCalledWith({
      derivationPath: "84'/2'/0'",
      skipOpenApp: false,
    });
    expect(result).toBe(expected);
  });

  it("should forward skipOpenApp", () => {
    new GetExtendedPublicKeyUseCase(appBinder).execute("44'/2'/0'", {
      skipOpenApp: true,
    });

    expect(getExtendedPublicKey).toHaveBeenCalledWith({
      derivationPath: "44'/2'/0'",
      skipOpenApp: true,
    });
  });
});
