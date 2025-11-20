import { type SwapTransactionSignerDAReturnType } from "@api/app-binder/SwapTransactionSignerDeviceActionTypes";
import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { SwapTransactionSignerUseCase } from "./SwapTransactionSignerUseCase";

describe("SwapTransactionSignerUseCase", () => {
  const swapTransactionSignerMock = vi.fn();

  const fakeReturn = {
    observable: {},
    cancel: vi.fn(),
  } as unknown as SwapTransactionSignerDAReturnType;

  const appBinderMock = {
    SwapTransactionSigner: swapTransactionSignerMock,
  } as unknown as SolanaAppBinder;

  let useCase: SwapTransactionSignerUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SwapTransactionSignerUseCase(appBinderMock);
  });

  it("calls appBinder.SwapTransactionSigner with skipOpenApp=false when no options provided", () => {
    swapTransactionSignerMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("44'/501'/0'/0'", "BASE64_TX");

    expect(swapTransactionSignerMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/0'",
      serialisedTransaction: "BASE64_TX",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });

  it("passes skipOpenApp=true when option is set", () => {
    swapTransactionSignerMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("44'/501'/0'/1'", "b64_tx_2", {
      skipOpenApp: true,
    });

    expect(swapTransactionSignerMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/1'",
      serialisedTransaction: "b64_tx_2",
      skipOpenApp: true,
    });
    expect(result).toBe(fakeReturn);
  });

  it("passes skipOpenApp=false when option.skipOpenApp is false", () => {
    swapTransactionSignerMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("m/44'/501'/0'", "another_b64", {
      skipOpenApp: false,
    });

    expect(swapTransactionSignerMock).toHaveBeenCalledWith({
      derivationPath: "m/44'/501'/0'",
      serialisedTransaction: "another_b64",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });
});
