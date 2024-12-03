import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";
import { SendPayloadInChunksTask } from "./SendPayloadInChunksTask";

// mock SendCommandInChunksTask
jest.mock("./SendCommandInChunksTask");

describe("SendPayloadInChunksTask", () => {
  describe("run", () => {
    beforeAll(() => {
      jest.resetAllMocks();
    });

    it("should return a CommandResult", async () => {
      // GIVEN
      const payload = "0x1234";
      jest
        .spyOn(SendCommandInChunksTask.prototype, "run")
        .mockResolvedValue(CommandResultFactory({ data: "0x5678" }));

      // WHEN
      const result = await new SendPayloadInChunksTask({} as InternalApi, {
        payload,
        commandFactory: jest.fn(),
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
        commandFactory: jest.fn(),
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
