import { vi } from "vitest";

import { type IcpAppBinder } from "@internal/app-binder/IcpAppBinder";

import { SignUpdateCallUseCase } from "./SignUpdateCallUseCase";

describe("SignUpdateCallUseCase", () => {
  it("should forward the path, call and read-state requests to appBinder.signUpdateCall", () => {
    // ARRANGE
    const derivationPath = "44'/223'/0'/0/0";
    const callRequest = new Uint8Array([0x01, 0x02]);
    const readStateRequest = new Uint8Array([0x03, 0x04]);
    const expectedResult = { observable: {}, cancel: vi.fn() };
    const signUpdateCallMock = vi.fn().mockReturnValue(expectedResult);
    const appBinderMock = {
      signUpdateCall: signUpdateCallMock,
    } as unknown as IcpAppBinder;
    const useCase = new SignUpdateCallUseCase(appBinderMock);

    // ACT
    const result = useCase.execute(
      derivationPath,
      callRequest,
      readStateRequest,
      { skipOpenApp: true },
    );

    // ASSERT
    expect(signUpdateCallMock).toHaveBeenCalledWith({
      derivationPath,
      callRequest,
      readStateRequest,
      skipOpenApp: true,
    });
    expect(result).toBe(expectedResult);
  });
});
