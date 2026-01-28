import { type CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";

describe("GetAddressUseCase", () => {
  const derivationPath = "44'/118'";
  const address = "cosmos1some-address";
  const publicKey = new Uint8Array([0x1, 0x2, 0x3]);
  const getAddressMock = vi.fn().mockReturnValue({ address, publicKey });
  const appBinderMock = {
    getAddress: getAddressMock,
  } as unknown as CosmosAppBinder;
  let useCase: GetAddressUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetAddressUseCase(appBinderMock);
  });

  it("should return the address from the appBinder's getAddress method", () => {
    // GIVEN
    const checkOnDevice = true;
    const skipOpenApp = true;
    const prefix = "scrt";

    // WHEN
    const result = useCase.execute(derivationPath, prefix, {
      checkOnDevice,
      skipOpenApp,
    });

    // THEN
    expect(result).toEqual({ address, publicKey });
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice,
      prefix,
      skipOpenApp,
    });
  });

  it("should return the address from the appBinder's getAddress method with default options", () => {
    // WHEN
    const result = useCase.execute(derivationPath);

    // THEN
    expect(result).toEqual({ address, publicKey });
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      prefix: "cosmos",
      checkOnDevice: false,
      skipOpenApp: false,
    });
  });
});
