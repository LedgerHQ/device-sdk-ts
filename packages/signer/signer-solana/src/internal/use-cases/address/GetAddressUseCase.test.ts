import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

describe("GetAddressUseCase", () => {
  const derivationPath = "44'/501'";
  const address = "some-address";
  const getAddressMock = jest.fn().mockReturnValue(address);
  const appBinderMock = {
    getAddress: getAddressMock,
  } as unknown as SolanaAppBinder;
  let useCase: GetAddressUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetAddressUseCase(appBinderMock);
  });

  it("should return the address from the appBinder's getAddress method", () => {
    // GIVEN
    const checkOnDevice = true;

    // WHEN
    const result = useCase.execute(derivationPath, { checkOnDevice });

    // THEN
    expect(result).toEqual(address);
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice,
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
    });
  });
});
