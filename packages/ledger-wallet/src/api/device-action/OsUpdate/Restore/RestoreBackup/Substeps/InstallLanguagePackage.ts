import {
  InstallLanguagePackageDeviceAction,
  type InternalApi,
  type Language,
} from "@ledgerhq/device-management-kit";

type InstallLanguagePackageResult = ReturnType<
  InstallLanguagePackageDeviceAction["makeStateMachine"]
>;

export const installLanguagePackage = (
  internalApi: InternalApi,
  unlockTimeout: number,
  language: Language,
): InstallLanguagePackageResult =>
  new InstallLanguagePackageDeviceAction({
    input: { unlockTimeout, language },
  }).makeStateMachine(internalApi);
