import { RegisteredWallet, WalletPolicy } from "@api/model/Wallet";
import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";

import { RegisterWalletUseCase } from "./RegisterWalletUseCase";

describe("RegisterWalletUseCase", () => {
  const walletPolicy = new WalletPolicy(
    "My Multisig",
    "wsh(sortedmulti(2,@0/**,@1/**))",
    ["[f5acc2fd/48'/1'/0'/2']tpubXXX", "tpubYYY"],
  );
  const registeredWallet = new RegisteredWallet(
    walletPolicy.name,
    walletPolicy.descriptorTemplate,
    walletPolicy.keys,
    Uint8Array.from(new Array(32).fill(0x42)),
  );
  const registerWalletMock = vi.fn().mockReturnValue(registeredWallet);
  const appBinderMock = {
    registerWallet: registerWalletMock,
  } as unknown as BtcAppBinder;
  let useCase: RegisterWalletUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RegisterWalletUseCase(appBinderMock);
  });

  it("should return the registered wallet from the appBinder's registerWallet method", () => {
    // GIVEN
    const skipOpenApp = false;

    // WHEN
    const result = useCase.execute(walletPolicy, skipOpenApp);

    // THEN
    expect(result).toEqual(registeredWallet);
    expect(registerWalletMock).toHaveBeenCalledWith({
      wallet: walletPolicy,
      skipOpenApp,
    });
  });

  it("should pass skipOpenApp option correctly", () => {
    // GIVEN
    const skipOpenApp = true;

    // WHEN
    useCase.execute(walletPolicy, skipOpenApp);

    // THEN
    expect(registerWalletMock).toHaveBeenCalledWith({
      wallet: walletPolicy,
      skipOpenApp: true,
    });
  });
});
