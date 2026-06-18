import { ValidationError } from "@ledgerhq/device-management-kit";

import { type EthAppBinder } from "@internal/app-binder/EthAppBinder";

import { RegisterExternalAddressUseCase } from "./RegisterExternalAddressUseCase";

const validArgs = {
  name: "Alice",
  addressHex: "00000000000000000000000000000000deadbeef",
  scope: "Eth main",
  derivationPath: "44'/60'/0'/0/0",
  chainId: 1,
};

function makeAppBinder(): EthAppBinder {
  return {
    registerExternalAddress: vi.fn(),
  } as unknown as EthAppBinder;
}

describe("RegisterExternalAddressUseCase", () => {
  it("forwards valid args to appBinder.registerExternalAddress", () => {
    const appBinder = makeAppBinder();
    const useCase = new RegisterExternalAddressUseCase(appBinder);

    useCase.execute(validArgs);

    expect(appBinder.registerExternalAddress).toHaveBeenCalledWith(validArgs);
  });

  it("strips a leading 'm/' from derivationPath before forwarding", () => {
    const appBinder = makeAppBinder();
    const useCase = new RegisterExternalAddressUseCase(appBinder);

    useCase.execute({ ...validArgs, derivationPath: "m/44'/60'/0'/0/0" });

    expect(appBinder.registerExternalAddress).toHaveBeenCalledWith({
      ...validArgs,
      derivationPath: "44'/60'/0'/0/0",
    });
  });

  it("rejects empty name via M1 validators", () => {
    const appBinder = makeAppBinder();
    const useCase = new RegisterExternalAddressUseCase(appBinder);

    expect(() => useCase.execute({ ...validArgs, name: "" })).toThrow(
      ValidationError,
    );
    expect(appBinder.registerExternalAddress).not.toHaveBeenCalled();
  });

  it("rejects bad address length", () => {
    const appBinder = makeAppBinder();
    const useCase = new RegisterExternalAddressUseCase(appBinder);

    expect(() =>
      useCase.execute({ ...validArgs, addressHex: "0xdeadbeef" }),
    ).toThrow(ValidationError);
    expect(appBinder.registerExternalAddress).not.toHaveBeenCalled();
  });

  it("rejects non-positive chainId", () => {
    const appBinder = makeAppBinder();
    const useCase = new RegisterExternalAddressUseCase(appBinder);

    expect(() => useCase.execute({ ...validArgs, chainId: 0 })).toThrow(
      ValidationError,
    );
    expect(appBinder.registerExternalAddress).not.toHaveBeenCalled();
  });
});
