import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { DefaultDescriptorTemplate, DefaultWallet } from "@api/model/Wallet";
import { DefaultSignerBtc } from "@internal/DefaultSignerBtc";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";
import { SignPsbtUseCase } from "@internal/use-cases/sign-psbt/SignPsbtUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/sign-transaction/SignTransactionUseCase";

import { SignMessageUseCase } from "./use-cases/sign-message/SignMessageUseCase";

describe("DefaultSignerBtc", () => {
  it("should be defined", () => {
    const signer = new DefaultSignerBtc({
      dmk: {} as DeviceManagementKit,
      sessionId: "session-id",
    });
    expect(signer).toBeDefined();
  });

  it("should call getExtendedPublicKeyUseCase", () => {
    vi.spyOn(GetExtendedPublicKeyUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.getExtendedPublicKey("44'/0'/0'/0/0", {
      checkOnDevice: true,
    });
    expect(GetExtendedPublicKeyUseCase.prototype.execute).toHaveBeenCalled();
  });

  it("should call signMessageUseCase", () => {
    vi.spyOn(SignMessageUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const derivationPath = "44'/0'/0'/0/0";
    const message = "message";
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.signMessage(derivationPath, message);
    expect(SignMessageUseCase.prototype.execute).toHaveBeenCalled();
  });
  it("should call signPsbtUseCase", () => {
    vi.spyOn(SignPsbtUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.signPsbt(
      new DefaultWallet("44'/0'/0'", DefaultDescriptorTemplate.NATIVE_SEGWIT),
      "",
    );
    expect(SignPsbtUseCase.prototype.execute).toHaveBeenCalled();
  });
  it("should call signTransactionUseCase", () => {
    vi.spyOn(SignTransactionUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: vi.fn(),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.signTransaction(
      new DefaultWallet("44'/0'/0'", DefaultDescriptorTemplate.NATIVE_SEGWIT),
      "",
    );
    expect(SignTransactionUseCase.prototype.execute).toHaveBeenCalled();
  });
});
