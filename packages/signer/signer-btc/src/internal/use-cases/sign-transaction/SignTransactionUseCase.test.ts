import { DefaultDescriptorTemplate, DefaultWallet } from "@api/model/Wallet";
import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { SignTransactionUseCase } from "@internal/use-cases/sign-transaction/SignTransactionUseCase";

describe("SignTransactionUseCase", () => {
  it("should call signTransaction on appBinder with the correct arguments", () => {
    // Given
    const wallet = new DefaultWallet(
      "84'/0'/0'",
      DefaultDescriptorTemplate.NATIVE_SEGWIT,
    );
    const psbt = "some-psbt";
    const skipOpenApp = false;
    const appBinder = {
      signTransaction: vi.fn(),
    };
    const signTransactionUseCase = new SignTransactionUseCase(
      appBinder as unknown as BtcAppBinder,
    );

    // When
    signTransactionUseCase.execute(wallet, psbt, skipOpenApp);

    // Then
    expect(appBinder.signTransaction).toHaveBeenCalledWith({
      wallet,
      psbt,
      skipOpenApp,
    });
  });
});
