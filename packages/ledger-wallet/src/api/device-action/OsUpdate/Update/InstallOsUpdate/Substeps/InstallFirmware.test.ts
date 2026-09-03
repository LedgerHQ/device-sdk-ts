import {
  type GetOsVersionResponse,
  type InternalApi,
  OnboardingState,
  SeedWordCount,
} from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { installFirmware } from "@api/device-action/OsUpdate/Update/InstallOsUpdate/Substeps/InstallFirmware";

describe("InstallFirmware", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const { getSecureChannelService: getSecureChannelServiceMock } = apiMock;

  const deviceInfo = {
    isBootloader: false,
    isOsu: false,
    targetId: 0x33200004,
    seTargetId: 0x33200004,
    mcuTargetId: undefined,
    seVersion: "1.3.0",
    seFlags: new Uint8Array([0xe6, 0x00, 0x00, 0x00]),
    mcuSephVersion: "5.24",
    mcuBootloaderVersion: "0.48",
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
      hasEndorsementCertificateInSlot1: false,
      hasEndorsementCertificateInSlot2: false,
      numberOfWords: SeedWordCount.TwentyFour,
      currentWordIndex: 0,
      onboardingState: OnboardingState.Unknown,
    },
  } satisfies GetOsVersionResponse;

  const updateFirmwareMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    updateFirmwareMock.mockReturnValue(Right({}));
    getSecureChannelServiceMock.mockReturnValue({
      updateFirmware: updateFirmwareMock,
    } as unknown as ReturnType<InternalApi["getSecureChannelService"]>);
  });

  it("Should open a secure channel with the OSU firmware payload", () => {
    const firmware = {
      perso: "perso",
      firmware: "osu",
      firmwareKey: "osu-key",
    };

    installFirmware(apiMock)({ input: { deviceInfo, firmware } });

    expect(updateFirmwareMock).toHaveBeenCalledWith(deviceInfo, firmware);
  });
});
