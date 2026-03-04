import { type SolanaToolsAppBinder } from "@internal/app-binder/SolanaToolsAppBinder";

import { CraftTransactionUseCase } from "./CraftTransactionUseCase";

describe("CraftTransactionUseCase", () => {
  const craftTransactionMock = vi.fn();
  const appBinderMock = {
    craftTransaction: craftTransactionMock,
  } as unknown as SolanaToolsAppBinder;
  let useCase: CraftTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CraftTransactionUseCase(appBinderMock);
  });

  it("should call appBinder.craftTransaction with the correct params", () => {
    const derivationPath = "44'/501'/0'/0'";
    const serialisedTransaction = "serialised-tx-input";
    craftTransactionMock.mockReturnValue("crafted-tx");

    const result = useCase.execute(
      derivationPath,
      serialisedTransaction,
      false,
    );

    expect(craftTransactionMock).toHaveBeenCalledWith({
      derivationPath,
      serialisedTransaction,
      skipOpenApp: false,
    });
    expect(result).toEqual("crafted-tx");
  });
});
