import { type TypedData } from "@api/model/TypedData";
import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { SignTypedDataUseCase } from "./SignTypedDataUseCase";

describe("SignTypedDataUseCase", () => {
  it("should call signTypedData on appBinder with the correct arguments", () => {
    // Given
    const derivationPath = "m/44'/60'/0'/0/0";
    const typedData: TypedData = {
      domain: {},
      types: {},
      primaryType: "test",
      message: {},
    };
    const parser: TypedDataParserService = {
      parse: vi.fn(),
    };
    const appBinder = {
      signTypedData: vi.fn(),
    };
    const signTypedDataUseCase = new SignTypedDataUseCase(
      appBinder as unknown as EthAppBinder,
      parser,
    );

    // When
    signTypedDataUseCase.execute(derivationPath, typedData);

    // Then
    expect(appBinder.signTypedData).toHaveBeenCalledWith({
      derivationPath,
      parser,
      data: typedData,
      skipOpenApp: false,
    });
  });
});
