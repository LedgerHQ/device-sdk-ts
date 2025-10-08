import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

// mock SendCommandInChunksTask
vi.mock("./SendCommandInChunksTask");

describe("SendPayloadInChunksTask", () => {
  describe("run", () => {
    beforeAll(() => {
      vi.resetAllMocks();
    });

    it("should return a CommandResult", async () => {
      // GIVEN
      const payload = "0x1234";
      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({ data: "0x5678" }),
      );

      // WHEN
      const result = await new SendPayloadInChunksTask({} as InternalApi, {
        payload,
        commandFactory: vi.fn(),
      }).run();

      // THEN
      expect(result).toEqual(CommandResultFactory({ data: "0x5678" }));
    });

    it("should return an error CommandResult", async () => {
      // GIVEN
      const payload = "invalid-payload";

      // WHEN
      const result = await new SendPayloadInChunksTask({} as InternalApi, {
        payload,
        commandFactory: vi.fn(),
      }).run();

      // THEN
      expect(result).toEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Invalid payload"),
        }),
      );
    });

    it("should use PayloadUtils.getBufferFromPayload when withPayloadLength is true", async () => {
      // GIVEN
      const payload = "010203";
      const mockCommandFactory = vi.fn();
      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({ data: "0x5678" }),
      );

      // WHEN
      const result = await new SendPayloadInChunksTask({} as InternalApi, {
        payload,
        commandFactory: mockCommandFactory,
        withPayloadLength: true,
      }).run();

      // THEN
      expect(result).toEqual(CommandResultFactory({ data: "0x5678" }));
      expect(SendCommandInChunksTask.prototype.run).toHaveBeenCalledWith();
      // Verify that SendCommandInChunksTask was called with the correct data
      // The payload "010203" should be converted to [0x00, 0x03, 0x01, 0x02, 0x03] with length prefix
      const expectedData = new Uint8Array([0x00, 0x03, 0x01, 0x02, 0x03]);
      expect(SendCommandInChunksTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expectedData,
          commandFactory: mockCommandFactory,
        }),
      );
    });

    it("should use hexaStringToBuffer when withPayloadLength is false", async () => {
      // GIVEN
      const payload = "010203";
      const mockCommandFactory = vi.fn();
      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({ data: "0x5678" }),
      );

      // WHEN
      const result = await new SendPayloadInChunksTask({} as InternalApi, {
        payload,
        commandFactory: mockCommandFactory,
        withPayloadLength: false,
      }).run();

      // THEN
      expect(result).toEqual(CommandResultFactory({ data: "0x5678" }));
      expect(SendCommandInChunksTask.prototype.run).toHaveBeenCalledWith();
      // Verify that SendCommandInChunksTask was called with the correct data
      // The payload "010203" should be converted to [0x01, 0x02, 0x03] without length prefix
      const expectedData = new Uint8Array([0x01, 0x02, 0x03]);
      expect(SendCommandInChunksTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expectedData,
          commandFactory: mockCommandFactory,
        }),
      );
    });

    it("should use PayloadUtils.getBufferFromPayload when withPayloadLength is undefined (default)", async () => {
      // GIVEN
      const payload = "010203";
      const mockCommandFactory = vi.fn();
      vi.spyOn(SendCommandInChunksTask.prototype, "run").mockResolvedValue(
        CommandResultFactory({ data: "0x5678" }),
      );

      // WHEN
      const result = await new SendPayloadInChunksTask({} as InternalApi, {
        payload,
        commandFactory: mockCommandFactory,
        // withPayloadLength is undefined (default behavior)
      }).run();

      // THEN
      expect(result).toEqual(CommandResultFactory({ data: "0x5678" }));
      expect(SendCommandInChunksTask.prototype.run).toHaveBeenCalledWith();
      // Verify that SendCommandInChunksTask was called with the correct data
      // The payload "010203" should be converted to [0x00, 0x03, 0x01, 0x02, 0x03] with length prefix
      const expectedData = new Uint8Array([0x00, 0x03, 0x01, 0x02, 0x03]);
      expect(SendCommandInChunksTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expectedData,
          commandFactory: mockCommandFactory,
        }),
      );
    });

    it("should return an error CommandResult when withPayloadLength is true and payload is invalid", async () => {
      // GIVEN
      const payload = "invalid-payload";

      // WHEN
      const result = await new SendPayloadInChunksTask({} as InternalApi, {
        payload,
        commandFactory: vi.fn(),
        withPayloadLength: true,
      }).run();

      // THEN
      expect(result).toEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Invalid payload"),
        }),
      );
    });
  });
});
