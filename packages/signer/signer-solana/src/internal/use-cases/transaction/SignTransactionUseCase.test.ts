import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { SignTransactionUseCase } from "./SignTransactionUseCase";

describe("GetAppConfigurationUseCase", () => {
  const signTransactionMock = vi.fn();
  const appBinderMock = {
    signTransaction: signTransactionMock,
  } as unknown as SolanaAppBinder;
  let useCase: SignTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SignTransactionUseCase(appBinderMock);
  });

  it("should return the config from the appBinder's getAppConfiguration method", () => {
    // GIVEN
    signTransactionMock.mockReturnValue(new Uint8Array([0x042]));

    // WHEN
    const result = useCase.execute(
      "44'/501'/0'/0'",
      new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    );

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/0'",
      transaction: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      options: undefined,
    });
    expect(result).toEqual(new Uint8Array([0x042]));
  });
});
