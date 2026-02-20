import { type SolanaToolsAppBinder } from "@internal/app-binder/SolanaToolsAppBinder";

import { GenerateTransactionUseCase } from "./GenerateTransactionUseCase";

describe("GenerateTransactionUseCase", () => {
  const generateTransactionMock = vi.fn();
  const appBinderMock = {
    generateTransaction: generateTransactionMock,
  } as unknown as SolanaToolsAppBinder;
  let useCase: GenerateTransactionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GenerateTransactionUseCase(appBinderMock);
  });

  it("should call appBinder.generateTransaction with the correct params", () => {
    const derivationPath = "44'/501'/0'/0'";
    generateTransactionMock.mockReturnValue("generated-tx");

    const result = useCase.execute(derivationPath, false);

    expect(generateTransactionMock).toHaveBeenCalledWith({
      derivationPath,
      skipOpenApp: false,
    });
    expect(result).toEqual("generated-tx");
  });
});
