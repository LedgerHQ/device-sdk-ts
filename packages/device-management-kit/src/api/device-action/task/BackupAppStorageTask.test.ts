import { BackupStorageCommandError } from "@api/command/os/BackupStorageCommand";
import { GetAppStorageInfoCommandError } from "@api/command/os/GetAppStorageInfoCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import {
  BackupAppStorageTask,
  type BackupAppStorageTaskResponse,
} from "@api/device-action/task/BackupAppStorageTask";
import { CommandResultFactory, isSuccessCommandResult } from "@api/index";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";

describe("BackupAppStorageTask", () => {
  let api: InternalApi;
  let logger: LoggerPublisherService;
  const sendCommand = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      sendCommand,
    } as unknown as InternalApi;
    logger = {
      debug: vi.fn(),
    } as unknown as LoggerPublisherService;
  });

  describe("Success", () => {
    it("should backup app storage data successfully", async () => {
      // ARRANGE
      const task = new BackupAppStorageTask(
        {
          appName: "MyApp",
        },
        api,
        logger,
      );

      sendCommand
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { storageSize: 15 } }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              chunkData: new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89]),
              chunkSize: 5,
            },
          }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              chunkData: new Uint8Array([0x0a, 0x0b, 0x0c, 0x0d, 0x0e]),
              chunkSize: 5,
            },
          }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory({
            data: {
              chunkData: new Uint8Array([0x0f, 0x10, 0x11, 0x12, 0x13]),
              chunkSize: 5,
            },
          }),
        );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      expect(
        (result as { data: BackupAppStorageTaskResponse }).data.appStorageData,
      ).toBe("0x01234567890a0b0c0d0e0f10111213");
    });
  });

  describe("Error", () => {
    it("should return error when getting app storage info fails", async () => {
      // ARRANGE
      const task = new BackupAppStorageTask(
        {
          appName: "MyApp",
        },
        api,
        logger,
      );

      sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new GetAppStorageInfoCommandError({
            message: "Application not found.",
            errorCode: "5123",
          }),
        }),
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(result.status).toBe("ERROR");
    });

    it("should return error when backing up app storage data fails", async () => {
      // ARRANGE
      const task = new BackupAppStorageTask(
        {
          appName: "MyApp",
        },
        api,
        logger,
      );

      sendCommand
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { storageSize: 100 } }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory({
            error: new BackupStorageCommandError({
              message: "Failed to backup app storage data.",
              errorCode: "541c",
            }),
          }),
        );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      expect(
        (result as { error: BackupStorageCommandError }).error,
      ).toBeInstanceOf(BackupStorageCommandError);
      expect(
        (result as { error: BackupStorageCommandError }).error.message,
      ).toBe("Failed to backup app storage data.");
    });
  });
});
