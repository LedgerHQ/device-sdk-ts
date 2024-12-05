import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { DefaultSignerBtc } from "@internal/DefaultSignerBtc";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";

describe("DefaultSignerSolana", () => {
  it("should be defined", () => {
    const signer = new DefaultSignerBtc({
      dmk: {} as DeviceManagementKit,
      sessionId: "session-id",
    });
    expect(signer).toBeDefined();
  });

  it("should call getExtendedPublicKeyUseCase", () => {
    jest.spyOn(GetExtendedPublicKeyUseCase.prototype, "execute");
    const sessionId = "session-id";
    const dmk = {
      executeDeviceAction: jest.fn(),
    } as unknown as DeviceManagementKit;
    const signer = new DefaultSignerBtc({ dmk, sessionId });
    signer.getExtendedPublicKey("44'/0'/0'/0/0", {
      checkOnDevice: true,
    });
    expect(GetExtendedPublicKeyUseCase.prototype.execute).toHaveBeenCalled();
  });
});
