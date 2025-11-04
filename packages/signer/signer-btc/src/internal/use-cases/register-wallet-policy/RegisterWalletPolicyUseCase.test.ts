import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";

import { RegisterWalletPolicyUseCase } from "./RegisterWalletPolicyUseCase";

describe("RegisterWalletPolicyUseCase", () => {
  it("should call registerWalletPolicy on appBinder with the correct arguments", () => {
    // given
    const walletPolicy = {
      name: "wallet-name",
      descriptorTemplate: "wsh(sortedmulti(2,@0/**,@1/**))",
      keys: ["key1", "key2"],
    };
    const skipOpenApp = false;

    const appBinder = {
      registerWalletPolicy: vi.fn(),
    };
    const registerWalletPolicyUseCase = new RegisterWalletPolicyUseCase(
      appBinder as unknown as BtcAppBinder,
    );

    // when
    registerWalletPolicyUseCase.execute(walletPolicy, skipOpenApp);

    // then
    expect(appBinder.registerWalletPolicy).toHaveBeenCalledWith({
      walletPolicy,
      skipOpenApp,
    });
  });
});
