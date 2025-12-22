import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";

import { GetMasterFingerprintUseCase } from "./GetMasterFingerprintUseCase";

describe("GetMasterFingerprintUseCase", () => {
  const masterFingerprint = Uint8Array.from([0x82, 0x8d, 0xc2, 0xf3]);
  const getMasterFingerprintMock = vi.fn().mockReturnValue(masterFingerprint);
  const appBinderMock = {
    getMasterFingerprint: getMasterFingerprintMock,
  } as unknown as BtcAppBinder;
  let useCase: GetMasterFingerprintUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetMasterFingerprintUseCase(appBinderMock);
  });

  it("should return the master fingerprint from the appBinder's getMasterFingerprint method", () => {
    // GIVEN
    const skipOpenApp = false;

    // WHEN
    const result = useCase.execute({ skipOpenApp });

    // THEN
    expect(result).toEqual(masterFingerprint);
    expect(getMasterFingerprintMock).toHaveBeenCalledWith({
      skipOpenApp,
    });
  });

  it("should pass skipOpenApp option correctly", () => {
    // GIVEN
    const skipOpenApp = true;

    // WHEN
    useCase.execute({ skipOpenApp });

    // THEN
    expect(getMasterFingerprintMock).toHaveBeenCalledWith({
      skipOpenApp: true,
    });
  });
});
