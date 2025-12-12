import { type ReplayTransactionDAReturnType } from "@api/app-binder/ReplayTransactionDeviceActionTypes";
import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { ReplayTransactionUseCase } from "./ReplayTransactionUseCase";

describe("ReplayTransactionUseCase", () => {
  const replayTransactionMock = vi.fn();

  const fakeReturn = {
    observable: {},
    cancel: vi.fn(),
  } as unknown as ReplayTransactionDAReturnType;

  const appBinderMock = {
    replayTransaction: replayTransactionMock,
  } as unknown as SolanaAppBinder;

  let useCase: ReplayTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ReplayTransactionUseCase(appBinderMock);
  });

  it("calls appBinder.replayTransaction with skipOpenApp=false when no options provided", () => {
    replayTransactionMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("44'/501'/0'/0'", "BASE64_TX");

    expect(replayTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/0'",
      serialisedTransaction: "BASE64_TX",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });

  it("passes skipOpenApp=true when option is set", () => {
    replayTransactionMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("44'/501'/0'/1'", "b64_tx_2", {
      skipOpenApp: true,
    });

    expect(replayTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/1'",
      serialisedTransaction: "b64_tx_2",
      skipOpenApp: true,
    });
    expect(result).toBe(fakeReturn);
  });

  it("passes skipOpenApp=false when option.skipOpenApp is false", () => {
    replayTransactionMock.mockReturnValue(fakeReturn);

    const result = useCase.execute("m/44'/501'/0'", "another_b64", {
      skipOpenApp: false,
    });

    expect(replayTransactionMock).toHaveBeenCalledWith({
      derivationPath: "m/44'/501'/0'",
      serialisedTransaction: "another_b64",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });
});
