import { from } from "rxjs";
import { vi } from "vitest";

import { Curve } from "@api/model/Curve";
import { type XrpAppBinder } from "@internal/app-binder/XrpAppBinder";

import { GetAddressUseCase } from "./GetAddressUseCase";

const DERIVATION_PATH = "44'/144'/0'/0/0";

describe("GetAddressUseCase", () => {
  const setup = () => {
    const expectedResult = { observable: from([]), cancel: vi.fn() };
    const getAddressMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      getAddress: getAddressMock,
    } as unknown as XrpAppBinder;

    return {
      getAddressMock,
      expectedResult,
      useCase: new GetAddressUseCase(appBinderMock),
    };
  };

  it("should return the result from appBinder.getAddress", () => {
    // GIVEN
    const { useCase, expectedResult } = setup();

    // WHEN
    const result = useCase.execute(DERIVATION_PATH);

    // THEN
    expect(result).toBe(expectedResult);
  });

  it("should default the flags to false and the curve to secp256k1", () => {
    // GIVEN
    const { useCase, getAddressMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH);

    // THEN
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      checkOnDevice: false,
      returnChainCode: false,
      skipOpenApp: false,
      curve: Curve.Secp256k1,
    });
  });

  it("should apply the same defaults when an empty option object is given", () => {
    // GIVEN
    const { useCase, getAddressMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, {});

    // THEN
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      checkOnDevice: false,
      returnChainCode: false,
      skipOpenApp: false,
      curve: Curve.Secp256k1,
    });
  });

  it("should forward every option it is given", () => {
    // GIVEN
    const { useCase, getAddressMock } = setup();

    // WHEN
    useCase.execute(DERIVATION_PATH, {
      checkOnDevice: true,
      returnChainCode: true,
      skipOpenApp: true,
      curve: Curve.Ed25519,
    });

    // THEN
    expect(getAddressMock).toHaveBeenCalledWith({
      derivationPath: DERIVATION_PATH,
      checkOnDevice: true,
      returnChainCode: true,
      skipOpenApp: true,
      curve: Curve.Ed25519,
    });
  });
});
