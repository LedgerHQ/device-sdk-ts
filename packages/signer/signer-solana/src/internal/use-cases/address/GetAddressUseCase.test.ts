import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  const derivationPath = "44'/501'";
  const address = "some-address";
  const getAddressMock = vi.fn().mockReturnValue(address);
  const appBinderMock = {
    getAddress: getAddressMock,
  } as unknown as SolanaAppBinder;
  let useCase: GetAddressUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetAddressUseCase(appBinderMock);
  });

  it("should return the address from the appBinder's getAddress method", () => {
    // GIVEN
    const checkOnDevice = true;
    const skipOpenApp = true;

    // WHEN
    const result = useCase.execute(derivationPath, {
      checkOnDevice,
      skipOpenApp,
    });

    // THEN
    expect(result).toEqual(address);
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice,
      skipOpenApp,
    });
  });

  it("should return the address from the appBinder's getAddress method with default options", () => {
    // WHEN
    const result = useCase.execute(derivationPath);

    // THEN
    expect(result).toEqual(address);
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: false,
      skipOpenApp: false,
    });
  });
});
