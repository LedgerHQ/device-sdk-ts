import {
  CommandResultFactory,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { ProvideNetworkConfigurationCommand } from "@internal/app-binder/command/ProvideNetworkConfigurationCommand";

import { ProvideNetworkConfigurationTask } from "./ProvideNetworkConfigurationTask";
import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

// mock SendCommandInChunksTask
vi.mock("./SendCommandInChunksTask");

describe("ProvideNetworkConfigurationTask", () => {
  describe("run", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should create SendCommandInChunksTask with correct parameters and return its result", async () => {
      // GIVEN
      const mockApi = {} as InternalApi;
      const mockData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const mockResult = CommandResultFactory({ data: undefined });

      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        mockResult,
      );

      const mockSendCommandInChunksTask = vi.mocked(SendCommandInChunksTask);

      // WHEN
      const task = new ProvideNetworkConfigurationTask(mockApi, {
        data: mockData,
      });
      const result = await task.run();

      // THEN
      expect(mockSendCommandInChunksTask).toHaveBeenCalledWith(mockApi, {
        data: mockData,
        commandFactory: expect.any(Function),
      });

      // Verify that the command factory creates the correct command
      const commandFactory = mockSendCommandInChunksTask.mock.calls[0][1].commandFactory;
      const command = commandFactory({
        chunkedData: new Uint8Array([0x01, 0x02]),
        isFirstChunk: true,
      });

      expect(command).toBeInstanceOf(ProvideNetworkConfigurationCommand);
      expect(command).toMatchObject({
        args: {
          data: new Uint8Array([0x01, 0x02]),
          isFirstChunk: true,
        },
      });

      expect(result).toBe(mockResult);
    });

    it("should handle non-first chunks correctly", async () => {
      // GIVEN
      const mockApi = {} as InternalApi;
      const mockData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({ data: undefined }),
      );

      const mockSendCommandInChunksTask = vi.mocked(SendCommandInChunksTask);

      // WHEN
      const task = new ProvideNetworkConfigurationTask(mockApi, {
        data: mockData,
      });
      await task.run();

      // THEN
      const commandFactory = mockSendCommandInChunksTask.mock.calls[0][1].commandFactory;
      const command = commandFactory({
        chunkedData: new Uint8Array([0x03, 0x04]),
        isFirstChunk: false,
      });

      expect(command).toBeInstanceOf(ProvideNetworkConfigurationCommand);
      expect(command).toMatchObject({
        args: {
          data: new Uint8Array([0x03, 0x04]),
          isFirstChunk: false,
        },
      });
    });
  });
});