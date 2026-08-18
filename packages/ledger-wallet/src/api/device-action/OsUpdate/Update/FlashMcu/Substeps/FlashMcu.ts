import {
  ConnectToSecureChannelTask,
  type GetOsVersionResponse,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

type FlashMcuHandlerArgs = {
  input: {
    deviceInfo: GetOsVersionResponse;
    version: string;
  };
};

type SecureChannelEvents = ReturnType<ConnectToSecureChannelTask["run"]>;

type FlashMcuHandler = (args: FlashMcuHandlerArgs) => SecureChannelEvents;

export const flashMcu =
  (internalApi: InternalApi): FlashMcuHandler =>
  ({ input }: FlashMcuHandlerArgs): SecureChannelEvents =>
    new ConnectToSecureChannelTask(internalApi, {
      connection: internalApi
        .getSecureChannelService()
        .updateMcu(input.deviceInfo, { version: input.version }),
    }).run();
