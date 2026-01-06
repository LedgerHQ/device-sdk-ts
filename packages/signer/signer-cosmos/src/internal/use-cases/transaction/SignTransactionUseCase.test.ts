import { type CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

describe("GetAppConfigurationUseCase", () => {
  const signTransactionMock = vi.fn();
  const appBinderMock = {
    signTransaction: signTransactionMock,
  } as unknown as CosmosAppBinder;
  let useCase: SignTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SignTransactionUseCase(appBinderMock);
  });

  it("should return the signature from the appBinder's signTransaction method", () => {
    // GIVEN
    signTransactionMock.mockReturnValue(new Uint8Array([0x042]));

    // WHEN
    const result = useCase.execute(
      "44'/118'/0'/0/0'",
      new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    );

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/118'/0'/0/0'",
      serializedSignDoc: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
      options: undefined,
    });
    expect(result).toEqual(new Uint8Array([0x042]));
  });

  it("should forward skipOpenApp and bech32prefix to appBinder.signTransaction method", () => {
    // GIVEN
    const derivationPath = "44'/118'/0'/0/0'";
    const tx = new Uint8Array([0xaa, 0xbb]);
    const opts = {
      skipOpenApp: true,
      bech32prefix: "cosmos",
    };

    // WHEN
    useCase.execute(derivationPath, tx, opts);

    // THEN
    expect(signTransactionMock).toHaveBeenCalledWith({
      derivationPath,
      serializedSignDoc: tx,
      options: opts,
    });
  });
});
