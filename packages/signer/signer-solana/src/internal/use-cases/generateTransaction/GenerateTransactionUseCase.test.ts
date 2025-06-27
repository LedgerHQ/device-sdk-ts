import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { type SolanaAppBinder } from "@internal/app-binder/SolanaAppBinder";

import { GenerateTransactionUseCase } from "./GenerateTransactionUseCase";

describe("GenerateTransactionUseCase", () => {
  const generateTransactionMock = vi.fn();
  // stub return value: could be an object with .observable/.cancel, but we just treat it opaque
  const fakeReturn = {
    observable: {},
    cancel: vi.fn(),
  } as unknown as GenerateTransactionDAReturnType;
  const appBinderMock = {
    generateTransaction: generateTransactionMock,
  } as unknown as SolanaAppBinder;
  let useCase: GenerateTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GenerateTransactionUseCase(appBinderMock);
  });

  it("should call appBinder.generateTransaction with skipOpenApp=false when no options provided", () => {
    // GIVEN
    generateTransactionMock.mockReturnValue(fakeReturn);

    // WHEN
    const result = useCase.execute("44'/501'/0'/0'");

    // THEN
    expect(generateTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/0'",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });

  it("should pass skipOpenApp=true when option is set", () => {
    // GIVEN
    generateTransactionMock.mockReturnValue(fakeReturn);

    // WHEN
    const result = useCase.execute("44'/501'/0'/1'", { skipOpenApp: true });

    // THEN
    expect(generateTransactionMock).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'/1'",
      skipOpenApp: true,
    });
    expect(result).toBe(fakeReturn);
  });

  it("should pass skipOpenApp=false when option.skipOpenApp is false", () => {
    // GIVEN
    generateTransactionMock.mockReturnValue(fakeReturn);

    // WHEN
    const result = useCase.execute("m/44'/501'/0'", { skipOpenApp: false });

    // THEN
    expect(generateTransactionMock).toHaveBeenCalledWith({
      derivationPath: "m/44'/501'/0'",
      skipOpenApp: false,
    });
    expect(result).toBe(fakeReturn);
  });
});
