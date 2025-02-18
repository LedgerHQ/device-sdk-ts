import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { SendSignMessageTask } from "@internal/app-binder/task/SendSignMessageTask";

const DERIVATION_PATH = "44'/501'/0'/0'";

describe("SendSignMessageTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const SIMPLE_MESSAGE = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

  describe("run with SignOffChainMessageCommand", () => {
    it("should return an error if the command fails", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: SIMPLE_MESSAGE,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("no signature returned"),
        }),
      );

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        error: new InvalidStatusWordError("no signature returned"),
      });
    });

    it("should return success when the command executes successfully", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: SIMPLE_MESSAGE,
      };
      const expectedSignature = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: expectedSignature,
        }),
      );

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        data: expectedSignature,
      });
    });

    it("should handle invalid derivation paths", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const invalidDerivationPath = "invalid/path";
      const args = {
        derivationPath: invalidDerivationPath,
        sendingData: SIMPLE_MESSAGE,
      };

      // WHEN--------------------------------
      //-------------------------------------
      const task = new SendSignMessageTask(apiMock, args);

      // THEN--------------------------------
      //-------------------------------------
      await expect(task.run()).rejects.toThrowError();
    });

    it("should handle empty message data", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const emptyMessage = new Uint8Array([]);
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: emptyMessage,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: new Uint8Array([]),
        }),
      );

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      if ("data" in result) {
        expect(result.data).toEqual(new Uint8Array([]));
      } else {
        throw new Error("Expected result to have data property");
      }
    });

    it("should correctly build the APDU command", () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: SIMPLE_MESSAGE,
      };
      const task = new SendSignMessageTask(apiMock, args);
      const fullMessage = task["_buildFullMessage"](SIMPLE_MESSAGE);
      const paths = [44 | 0x80000000, 501 | 0x80000000, 0 | 0x80000000, 0];
      const commandBuffer = task["_buildApduCommand"](fullMessage, paths);

      // WHEN--------------------------------
      //-------------------------------------
      const expectedCommandLength =
        1 + // numberOfSigners
        1 + // numberOfDerivations
        paths.length * 4 + // paths
        fullMessage.length; // message

      // THEN--------------------------------
      //-------------------------------------
      expect(commandBuffer.length).toEqual(expectedCommandLength);
    });

    it("should handle messages with maximum allowed length", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const headerSize =
        1 + // numberOfSigners
        1 + // numberOfDerivations
        4 * 4; // paths
      const fullMessageHeaderSize =
        1 +
        15 + // prefix
        4; // length
      const maxLengthMessage = new Uint8Array(
        255 - headerSize - fullMessageHeaderSize,
      ).fill(0x01);
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: maxLengthMessage,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: new Uint8Array([0x99, 0x88, 0x77]),
        }),
      );

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      if ("data" in result) {
        expect(result.data).toEqual(new Uint8Array([0x99, 0x88, 0x77]));
      } else {
        throw new Error("Expected result to have data property");
      }
    });

    it("should fail messages if too big", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const headerSize =
        1 + // numberOfSigners
        1 + // numberOfDerivations
        4 * 4; // paths
      const fullMessageHeaderSize =
        1 +
        15 + // prefix
        4; // length
      const maxLengthMessage = new Uint8Array(
        256 - headerSize - fullMessageHeaderSize,
      ).fill(0x01);
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: maxLengthMessage,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: new Uint8Array([0x99, 0x88, 0x77]),
        }),
      );

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
      if ("error" in result) {
        expect(result.error).toEqual(
          new InvalidStatusWordError(
            "The APDU command exceeds the maximum allowable size (255 bytes)",
          ),
        );
      } else {
        throw new Error("Expected result to have error property");
      }
    });
  });
});
