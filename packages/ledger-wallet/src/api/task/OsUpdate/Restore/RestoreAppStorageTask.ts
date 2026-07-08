import {
  APDU_MAX_PAYLOAD,
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import {
  RestoreAppStorageCommand,
  type RestoreAppStorageCommandErrorCodes,
} from "@api/command/OsUpdate/Restore/RestoreAppStorageCommand";

export type RestoreAppStorageTaskArgs = {
  appStorageData: Uint8Array;
};

export type RestoreAppStorageTaskError =
  CommandErrorResult<RestoreAppStorageCommandErrorCodes>["error"];

export class RestoreAppStorageTask {
  constructor(
    private readonly args: RestoreAppStorageTaskArgs,
    private readonly api: InternalApi,
    private readonly logger: LoggerPublisherService,
  ) {}

  public async run(): Promise<DmkResult<void, RestoreAppStorageTaskError>> {
    const { appStorageData } = this.args;

    this.logger.debug("[run] Starting RestoreAppStorageTask", {
      data: {
        appStorageDataLength: appStorageData.length,
      },
    });

    let offset = 0;

    while (offset < appStorageData.length) {
      const chunkData = appStorageData.subarray(
        offset,
        offset + APDU_MAX_PAYLOAD,
      );

      const restoreAppStorage = await this.api.sendCommand(
        new RestoreAppStorageCommand({ chunkData }),
      );

      if (!isSuccessCommandResult(restoreAppStorage)) {
        this.logger.debug("[run] Failed to restore app storage chunk", {
          data: { error: restoreAppStorage.error },
        });
        return DmkResultFactory({
          error: restoreAppStorage.error,
        });
      }

      offset += chunkData.length;
    }

    this.logger.debug("[run] App storage data restored successfully");

    return DmkResultFactory({
      data: undefined,
    });
  }
}
