import { type CraftTransactionDAReturnType } from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { CraftTransactionUseCase } from "./CraftTransactionUseCase";

describe("CraftTransactionUseCase", () => {
  const craftTransactionMock = vi.fn();

  const fakeReturn = {
    observable: {},
    cancel: vi.fn(),
  } as unknown as CraftTransactionDAReturnType;

  const appBinderMock = {
    craftTransaction: craftTransactionMock,
  } as unknown as SolanaAppBinder;

  let useCase: CraftTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CraftTransactionUseCase(appBinderMock);
  });

  it("calls appBinder.craftTransaction with skipOpenApp=false when no options provided", () => {
    craftTransactionMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("44'/501'/0'/0'", "BASE64_TX");

    expect(craftTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/0'",
      serialisedTransaction: "BASE64_TX",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });

  it("passes skipOpenApp=true when option is set", () => {
    craftTransactionMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("44'/501'/0'/1'", "b64_tx_2", {
      skipOpenApp: true,
    });

    expect(craftTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/1'",
      serialisedTransaction: "b64_tx_2",
      skipOpenApp: true,
    });
    expect(result).toBe(fakeReturn);
  });

  it("passes skipOpenApp=false when option.skipOpenApp is false", () => {
    craftTransactionMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("m/44'/501'/0'", "another_b64", {
      skipOpenApp: false,
    });

    expect(craftTransactionMock).toHaveBeenCalledWith({
      derivationPath: "m/44'/501'/0'",
      serialisedTransaction: "another_b64",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });
});
