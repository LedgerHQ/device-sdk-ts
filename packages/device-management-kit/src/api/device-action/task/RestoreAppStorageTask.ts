import { APDU_MAX_PAYLOAD } from "@api/apdu/utils/ApduBuilder";
import {
  type CommandErrorResult,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import {
  RestoreAppStorageCommand,
  type RestoreAppStorageCommandErrorCodes,
} from "@api/command/os/RestoreAppStorageCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type DmkResult, DmkResultFactory } from "@api/model/DmkResult";

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
