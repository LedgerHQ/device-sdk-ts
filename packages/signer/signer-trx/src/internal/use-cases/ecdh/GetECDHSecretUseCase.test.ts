import { type TronAppBinder } from "@internal/app-binder/TronAppBinder";

import { GetECDHSecretUseCase } from "./GetECDHSecretUseCase";

describe("GetECDHSecretUseCase", () => {
  const derivationPath = "44'/195'/0'/0/0";
  const publicKey = new Uint8Array(65).fill(0x04);
  const returnedValue = { observable: "observable", cancel: () => {} };
  const getECDHSecretMock = vi.fn().mockReturnValue(returnedValue);
  const appBinderMock = {
    getECDHSecret: getECDHSecretMock,
  } as unknown as TronAppBinder;
  let useCase: GetECDHSecretUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetECDHSecretUseCase(appBinderMock);
  });

  it("should forward the public key and options to the app binder", () => {
    // WHEN
    const result = useCase.execute(derivationPath, publicKey, {
      skipOpenApp: true,
    });

    // THEN
    expect(result).toEqual(returnedValue);
    expect(getECDHSecretMock).toHaveBeenCalledWith({
      derivationPath,
      publicKey,
      skipOpenApp: true,
    });
  });

  it("should work without options", () => {
    // WHEN
    const result = useCase.execute(derivationPath, publicKey);

    // THEN
    expect(result).toEqual(returnedValue);
    expect(getECDHSecretMock).toHaveBeenCalledWith({
      derivationPath,
      publicKey,
      skipOpenApp: undefined,
    });
  });
});
