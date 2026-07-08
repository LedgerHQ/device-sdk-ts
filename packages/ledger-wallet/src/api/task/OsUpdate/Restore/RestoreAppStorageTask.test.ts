import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";
import {
  CommandResultFactory,
  DmkResultFactory,
  type InternalApi,
  isSuccessDmkResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { RestoreAppStorageCommandError } from "@api/command/OsUpdate/Restore/RestoreAppStorageCommand";

import { RestoreAppStorageTask } from "./RestoreAppStorageTask";

describe("RestoreAppStorageTask", () => {
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
    it("should send a single chunk when the data fits in one APDU", async () => {
      // ARRANGE
      const appStorageData = Uint8Array.from([0x01, 0x02, 0x03]);
      const task = new RestoreAppStorageTask({ appStorageData }, api, logger);

      sendCommand.mockResolvedValueOnce(
        CommandResultFactory({ data: undefined }),
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessDmkResult(result)).toBe(true);
      expect(sendCommand).toHaveBeenCalledTimes(1);
      expect(sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          args: { chunkData: appStorageData },
        }),
      );
    });

    it("should split the data into several chunks when it does not fit in a single APDU", async () => {
      // ARRANGE
      const appStorageData = new Uint8Array(APDU_MAX_PAYLOAD + 45).map(
        (_, i) => i % 256,
      );
      const task = new RestoreAppStorageTask({ appStorageData }, api, logger);

      sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: undefined }))
        .mockResolvedValueOnce(CommandResultFactory({ data: undefined }));

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessDmkResult(result)).toBe(true);
      expect(sendCommand).toHaveBeenCalledTimes(2);
      expect(sendCommand).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          args: { chunkData: appStorageData.slice(0, APDU_MAX_PAYLOAD) },
        }),
      );
      expect(sendCommand).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          args: { chunkData: appStorageData.slice(APDU_MAX_PAYLOAD) },
        }),
      );
    });

    it("should not send any command when the data is empty", async () => {
      // ARRANGE
      const task = new RestoreAppStorageTask(
        { appStorageData: new Uint8Array(0) },
        api,
        logger,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessDmkResult(result)).toBe(true);
      expect(sendCommand).not.toHaveBeenCalled();
    });
  });

  describe("Error", () => {
    it("should return error when restoring a chunk fails", async () => {
      // ARRANGE
      const appStorageData = Uint8Array.from([0x01, 0x02, 0x03]);
      const task = new RestoreAppStorageTask({ appStorageData }, api, logger);

      sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new RestoreAppStorageCommandError({
            message: "Failed to decrypt the app storage backup.",
            errorCode: "541a",
          }),
        }),
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(result).toStrictEqual(
        DmkResultFactory({
          error: new RestoreAppStorageCommandError({
            message: "Failed to decrypt the app storage backup.",
            errorCode: "541a",
          }),
        }),
      );
    });

    it("should stop sending chunks as soon as one fails", async () => {
      // ARRANGE
      const appStorageData = new Uint8Array(APDU_MAX_PAYLOAD + 10);
      const task = new RestoreAppStorageTask({ appStorageData }, api, logger);

      sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new RestoreAppStorageCommandError({
            message: "Invalid chunk length.",
            errorCode: "6734",
          }),
        }),
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessDmkResult(result)).toBe(false);
      expect(sendCommand).toHaveBeenCalledTimes(1);
    });
  });
});
