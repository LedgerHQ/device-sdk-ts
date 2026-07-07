import {
  bufferToHexaString,
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type HexaString,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import {
  BackupAppStorageCommand,
  type BackupAppStorageCommandErrorCodes,
} from "@api/command/OsUpdate/Backup/BackupAppStorageCommand";
import {
  GetAppStorageInfoCommand,
  type GetAppStorageInfoCommandErrorCodes,
} from "@api/command/OsUpdate/Backup/GetAppStorageInfoCommand";

export type BackupAppStorageTaskArgs = {
  appName: string;
};

export type BackupAppStorageTaskResponse = {
  appStorageData: HexaString;
};

export type BackupAppStorageTaskErrorCodes =
  | GetAppStorageInfoCommandErrorCodes
  | BackupAppStorageCommandErrorCodes;

export type BackupAppStorageTaskError =
  | CommandErrorResult<GetAppStorageInfoCommandErrorCodes>["error"]
  | CommandErrorResult<BackupAppStorageCommandErrorCodes>["error"];

export class BackupAppStorageTask {
  constructor(
    private readonly args: BackupAppStorageTaskArgs,
    private readonly api: InternalApi,
    private readonly logger: LoggerPublisherService,
  ) {}

  public async run(): Promise<
    DmkResult<BackupAppStorageTaskResponse, BackupAppStorageTaskError>
  > {
    this.logger.debug("[run] Starting BackupAppStorageTask", {
      data: {
        appName: this.args.appName,
      },
    });

    const { appName } = this.args;

    const getAppStorageInfo = await this.api.sendCommand(
      new GetAppStorageInfoCommand({
        appName,
      }),
    );

    if (!isSuccessCommandResult(getAppStorageInfo)) {
      this.logger.debug("[run] Failed to get app storage info", {
        data: { error: getAppStorageInfo.error },
      });
      return DmkResultFactory({
        error: getAppStorageInfo.error,
      });
    }

    const { storageSize } = getAppStorageInfo.data;
    let offset = 0;
    let appStorageDataBytes = new Uint8Array(0);

    while (offset < storageSize) {
      const backupStorage = await this.api.sendCommand(
        new BackupAppStorageCommand(),
      );
      if (!isSuccessCommandResult(backupStorage)) {
        this.logger.debug("[run] Failed to backup app storage", {
          data: { error: backupStorage.error },
        });
        return DmkResultFactory({
          error: backupStorage.error,
        });
      }

      const { chunkData, chunkSize } = backupStorage.data;
      appStorageDataBytes = Uint8Array.from([
        ...appStorageDataBytes,
        ...chunkData,
      ]);
      offset += chunkSize;
    }

    const appStorageData = bufferToHexaString(appStorageDataBytes);
    this.logger.debug("[run] App storage data backed up successfully", {
      data: {
        appStorageData,
      },
    });

    return DmkResultFactory({
      data: {
        appStorageData,
      },
    });
  }
}
