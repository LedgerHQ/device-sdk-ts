import {
  type CommandResult,
  CommandResultFactory,
  CommandResultStatus,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { makeDeviceActionInternalApiMock } from "@ledgerhq/device-management-kit/src/api/device-action/__test-utils__/makeInternalApi.js";
import { Just, Left, Right } from "purify-ts";

import { ContinueCommand } from "@internal/app-binder/command/ContinueCommand";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import {
  ClientCommandCodes,
  SW_INTERRUPTED_EXECUTION,
} from "@internal/app-binder/command/utils/constants";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";

import { SendSignMessageTask } from "./SignMessageTask";

const EXACT_ONE_CHUNK_MESSAGE = "a".repeat(64);
const EXACT_TWO_CHUNKS_MESSAGE = "a".repeat(128);
const DERIVATION_PATH = "44'/0'/0'/0/0";
const PREIMAGE = new Uint8Array([1, 2, 3, 4]);
const MERKLE_ROOT = new Uint8Array(32).fill(0x01);

const signature = {
  v: 27,
  r: "0x1212121212121212121212121212121212121212121212121212121212121212",
  s: "0x3434343434343434343434343434343434343434343434343434343434343434",
};

describe("SendSignMessageTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const resultOk = CommandResultFactory({
    data: Just(signature),
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("run", () => {
    it("should correctly chunk a message that fits in 1 chunk", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_ONE_CHUNK_MESSAGE,
      };

      jest
        .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
        .mockImplementation((_, chunks) => {
          expect(chunks.length).toBe(1); // validate the number of chunks
          return MERKLE_ROOT;
        });

      apiMock.sendCommand.mockResolvedValueOnce(resultOk);

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
      expect(result.status).toBe(CommandResultStatus.Success);
      // @ts-expect-error
      if (result.data.isJust()) {
        // @ts-expect-error
        expect(result.data.extract()).toStrictEqual(signature);
      } else {
        throw new Error("Expected Just value, but got Nothing");
      }
    });

    it("should correctly chunk a message that fits in 2 chunks", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_TWO_CHUNKS_MESSAGE,
      };

      jest
        .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
        .mockImplementation((_, chunks) => {
          expect(chunks.length).toBe(2); // validate the number of chunks
          return MERKLE_ROOT;
        });

      apiMock.sendCommand.mockResolvedValueOnce(resultOk);

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
      expect(result.status).toBe(CommandResultStatus.Success);
      // @ts-expect-error
      if (result.data.isJust()) {
        // @ts-expect-error
        expect(result.data.extract()).toStrictEqual(signature);
      } else {
        throw new Error("Expected Just value, but got Nothing");
      }
    });

    it("should handle interrupted execution with YIELD, CONTINUE, and GET_PREIMAGE commands in sequence", async () => {
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_TWO_CHUNKS_MESSAGE,
      };

      jest
        .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
        .mockImplementation((_, chunks) => {
          expect(chunks.length).toBe(2); // validate the number of chunks
          return MERKLE_ROOT;
        });

      // mock command sequence
      apiMock.sendCommand
        .mockResolvedValueOnce({
          statusCode: SW_INTERRUPTED_EXECUTION, // SW_INTERRUPTED_EXECUTION
          data: new Uint8Array([ClientCommandCodes.YIELD]),
        } as unknown as CommandResult<Uint8Array, Error>)
        .mockResolvedValueOnce({
          statusCode: SW_INTERRUPTED_EXECUTION, // SW_INTERRUPTED_EXECUTION for first ContinueCommand
          data: new Uint8Array([ClientCommandCodes.GET_PREIMAGE]),
        } as unknown as CommandResult<Uint8Array, Error>)
        .mockResolvedValueOnce(resultOk);

      jest
        .spyOn(ClientCommandInterpreter.prototype, "getClientCommandPayload")
        .mockImplementation((request, context) => {
          const commandCode = request[0];
          if (commandCode === 0x10) {
            // YIELD
            context.yieldedResults.push(new Uint8Array([]));
            return Right(new Uint8Array()); // continueCommand with empty payload
          }
          if (commandCode === 0x40) {
            // GET_PREIMAGE
            return Right(PREIMAGE); // continueCommand with preimage
          }
          return Left(new InvalidStatusWordError("Unhandled command"));
        });

      // WHEN
      const sendSignMessageTask = new SendSignMessageTask(apiMock, args);
      const result = await sendSignMessageTask.run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);

      const firstCommand = apiMock.sendCommand.mock.calls[0]?.[0];
      expect(firstCommand).toBeInstanceOf(SignMessageCommand);

      const firstContinueCommand = apiMock.sendCommand.mock.calls[1]?.[0];
      expect(firstContinueCommand).toBeInstanceOf(ContinueCommand);

      const secondContinueCommand = apiMock.sendCommand.mock.calls[2]?.[0];
      expect(secondContinueCommand).toBeInstanceOf(ContinueCommand);

      expect(result.status).toBe(CommandResultStatus.Success);
      // @ts-expect-error
      if (result.data.isJust()) {
        // @ts-expect-error
        expect(result.data.extract()).toStrictEqual(signature);
      } else {
        throw new Error("Expected Just value, but got Nothing");
      }
    });
  });
});
