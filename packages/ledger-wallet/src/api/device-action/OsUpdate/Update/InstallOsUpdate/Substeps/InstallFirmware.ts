import {
  ConnectToSecureChannelTask,
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

export type FirmwareToInstall = {
  perso: string;
  firmware: string;
  firmwareKey: string;
};

type InstallFirmwareHandlerArgs = {
  input: {
    deviceInfo: GetOsVersionResponse;
    firmware: FirmwareToInstall;
  };
};

type SecureChannelEvents = ReturnType<ConnectToSecureChannelTask["run"]>;

type InstallFirmwareHandler = (
  args: InstallFirmwareHandlerArgs,
) => SecureChannelEvents;

export const installFirmware =
  (internalApi: InternalApi): InstallFirmwareHandler =>
  ({ input }: InstallFirmwareHandlerArgs): SecureChannelEvents =>
    new ConnectToSecureChannelTask(internalApi, {
      connection: internalApi
        .getSecureChannelService()
        .updateFirmware(input.deviceInfo, input.firmware),
    }).run();
