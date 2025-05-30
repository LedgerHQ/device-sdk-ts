import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";

import { GetExtendedPublicKeyUseCase } from "./GetExtendedPublicKeyUseCase";

describe("GetAddressUseCase", () => {
  const derivationPath = "44'/501'";
  const address = "some-pkey";
  const getExtendedPublicKeyMock = vi.fn().mockReturnValue(address);
  const appBinderMock = {
    getExtendedPublicKey: getExtendedPublicKeyMock,
  } as unknown as BtcAppBinder;
  let useCase: GetExtendedPublicKeyUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetExtendedPublicKeyUseCase(appBinderMock);
  });

  it("should return the address from the appBinder's getExtendedPublicKey method", () => {
    // GIVEN
    const checkOnDevice = true;
    const skipOpenApp = false;

    // WHEN
    const result = useCase.execute(derivationPath, {
      checkOnDevice,
      skipOpenApp,
    });

    // THEN
    expect(result).toEqual(address);
    expect(getExtendedPublicKeyMock).toHaveBeenCalledWith({
      derivationPath,
      checkOnDevice,
      skipOpenApp,
    });
  });
});
