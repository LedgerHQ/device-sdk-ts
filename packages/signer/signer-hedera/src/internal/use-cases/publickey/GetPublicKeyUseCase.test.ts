import { vi } from "vitest";

import { type HederaAppBinder } from "@internal/app-binder/HederaAppBinder";

import { GetPublicKeyUseCase } from "./GetPublicKeyUseCase";

describe("GetPublicKeyUseCase", () => {
  const makeUseCase = (getPublicKeyMock: ReturnType<typeof vi.fn>) =>
    new GetPublicKeyUseCase({
      getPublicKey: getPublicKeyMock,
    } as unknown as HederaAppBinder);

  it("should forward the key index and default options to appBinder.getPublicKey", () => {
    // ARRANGE
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const getPublicKeyMock = vi.fn().mockReturnValue(expectedResult);
    const useCase = makeUseCase(getPublicKeyMock);

    // ACT
    const result = useCase.execute(0);

    // ASSERT
    expect(getPublicKeyMock).toHaveBeenCalledWith({
      keyIndex: 0,
      checkOnDevice: false,
      skipOpenApp: false,
    });
    expect(result).toBe(expectedResult);
  });

  it("should forward provided options", () => {
    // ARRANGE
    const getPublicKeyMock = vi.fn().mockReturnValue({});
    const useCase = makeUseCase(getPublicKeyMock);

    // ACT
    useCase.execute(7, { checkOnDevice: true, skipOpenApp: true });

    // ASSERT
    expect(getPublicKeyMock).toHaveBeenCalledWith({
      keyIndex: 7,
      checkOnDevice: true,
      skipOpenApp: true,
    });
  });

  it("should throw on an invalid key index without reaching the device", () => {
    // ARRANGE
    const getPublicKeyMock = vi.fn();
    const useCase = makeUseCase(getPublicKeyMock);

    // ACT & ASSERT
    expect(() => useCase.execute(-1)).toThrow("Invalid Hedera key index");
    expect(getPublicKeyMock).not.toHaveBeenCalled();
  });
});
