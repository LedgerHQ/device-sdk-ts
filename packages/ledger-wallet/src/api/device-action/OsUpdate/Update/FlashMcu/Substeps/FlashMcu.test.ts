import {
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { flashMcu } from "@api/device-action/OsUpdate/Update/FlashMcu/Substeps/FlashMcu";

describe("FlashMcu", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { getSecureChannelService: getSecureChannelServiceMock } = apiMock;

  const deviceInfo = {
    isBootloader: true,
    isOsu: false,
    targetId: 0x01000001,
    seTargetId: 0x33200004,
    mcuTargetId: 0x01000001,
    seVersion: "1.3.0",
    seFlags: new Uint8Array([0xe6, 0x00, 0x00, 0x00]),
    mcuSephVersion: "",
    mcuBootloaderVersion: "1.16",
    hwVersion: "00",
    langId: 0,
    recoverState: undefined,
    secureElementFlags: {
      isPinValidated: true,
      hasMcuSerialNumber: true,
      hasValidCertificate: true,
      isCustomAuthorityConnectionAllowed: false,
      isSecureConnectionAllowed: false,
      isOnboarded: true,
      isMcuCodeSigned: true,
      isInRecoveryMode: false,
    },
  } satisfies GetOsVersionResponse;

  const updateMcuMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    updateMcuMock.mockReturnValue(Right({}));
    getSecureChannelServiceMock.mockReturnValue({
      updateMcu: updateMcuMock,
    } as unknown as ReturnType<InternalApi["getSecureChannelService"]>);
  });

  it("Should open a secure channel with the resolved MCU version", () => {
    flashMcu(apiMock)({ input: { deviceInfo, version: "1.12" } });

    expect(updateMcuMock).toHaveBeenCalledWith(deviceInfo, {
      version: "1.12",
    });
  });
});
