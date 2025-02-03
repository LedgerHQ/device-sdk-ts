import { DefaultDescriptorTemplate, DefaultWallet } from "@api/model/Wallet";
import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";

import { SignPsbtUseCase } from "./SignPsbtUseCase";

describe("SignPsbtUseCase", () => {
  it("should call signPsbt on appBinder with the correct arguments", () => {
    // Given
    const wallet = new DefaultWallet(
      "84'/0'/0'",
      DefaultDescriptorTemplate.NATIVE_SEGWIT,
    );
    const psbt = "some-psbt";
    const appBinder = {
      signPsbt: vi.fn(),
    };
    const signPsbtUseCase = new SignPsbtUseCase(
      appBinder as unknown as BtcAppBinder,
    );

    // When
    signPsbtUseCase.execute(wallet, psbt);

    // Then
    expect(appBinder.signPsbt).toHaveBeenCalledWith({
      wallet,
      psbt,
    });
  });
});
