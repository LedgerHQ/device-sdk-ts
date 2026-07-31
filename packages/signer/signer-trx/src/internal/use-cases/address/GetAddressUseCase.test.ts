import { type TronAppBinder } from "@internal/app-binder/TronAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  const derivationPath = "44'/195'/0'/0/0";
  const returnedValue = { address: "some-address" };
  const getAddressMock = vi.fn().mockReturnValue(returnedValue);
  const appBinderMock = {
    getAddress: getAddressMock,
  } as unknown as TronAppBinder;
  let useCase: GetAddressUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetAddressUseCase(appBinderMock);
  });

  it("should forward the provided options to the app binder", () => {
    // GIVEN
    const checkOnDevice = true;
    const skipOpenApp = true;

    // WHEN
    const result = useCase.execute(derivationPath, {
      checkOnDevice,
      skipOpenApp,
    });

    // THEN
    expect(result).toEqual(returnedValue);
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice,
      skipOpenApp,
    });
  });

  it("should default checkOnDevice and skipOpenApp to false", () => {
    // WHEN
    const result = useCase.execute(derivationPath);

    // THEN
    expect(result).toEqual(returnedValue);
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice: false,
      skipOpenApp: false,
    });
  });
});
