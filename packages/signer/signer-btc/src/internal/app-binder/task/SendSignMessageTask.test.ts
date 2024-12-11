import {
  CommandResultFactory,
  CommandResultStatus,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { type ApduResponse } from "@ledgerhq/device-management-kit";
import { makeDeviceActionInternalApiMock } from "@ledgerhq/device-management-kit/src/api/device-action/__test-utils__/makeInternalApi.js";
import { Left, Right } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { ClientCommandHandlerError } from "@internal/app-binder/command/client-command-handlers/Errors";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import {
  BUFFER_SIZE,
  CHUNK_SIZE,
  ClientCommandCodes,
  SW_INTERRUPTED_EXECUTION,
} from "@internal/app-binder/command/utils/constants";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";

import { SendSignMessageTask } from "./SignMessageTask";

const EXACT_ONE_CHUNK_MESSAGE = "a".repeat(CHUNK_SIZE);
const EXACT_TWO_CHUNKS_MESSAGE = "a".repeat(CHUNK_SIZE * 2);
const DERIVATION_PATH = "44'/0'/0'/0/0";
const PREIMAGE = new Uint8Array([1, 2, 3, 4]);
const MERKLE_ROOT = new Uint8Array(BUFFER_SIZE).fill(0x01);

const SIGNATURE: Signature = {
  v: 27,
  r: "0x1212121212121212121212121212121212121212121212121212121212121212",
  s: "0x3434343434343434343434343434343434343434343434343434343434343434",
};

const APDU_RESPONSE_YELD: ApduResponse = {
  statusCode: SW_INTERRUPTED_EXECUTION,
  data: new Uint8Array([ClientCommandCodes.YIELD]),
};

describe("SendSignMessageTask", () => {
  const signatureResult = CommandResultFactory<Signature, Error>({
    data: SIGNATURE,
  });
  const apiMock = makeDeviceActionInternalApiMock();

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
          expect(chunks.length).toBe(1);
          return MERKLE_ROOT;
        });

      apiMock.sendCommand.mockResolvedValueOnce(signatureResult);

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(CommandResultStatus.Success);
      if (result.status === CommandResultStatus.Success) {
        expect(result.data).toStrictEqual(SIGNATURE);
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
          expect(chunks.length).toBe(2);
          return MERKLE_ROOT;
        });

      apiMock.sendCommand.mockResolvedValueOnce(signatureResult);

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(CommandResultStatus.Success);
      if (result.status === CommandResultStatus.Success) {
        expect(result.data).toStrictEqual(SIGNATURE);
      }
    });

    it("should handle interrupted execution with interactive commands", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_TWO_CHUNKS_MESSAGE,
      };

      jest
        .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
        .mockImplementation((_, chunks) => {
          expect(chunks.length).toBe(2);
          return MERKLE_ROOT;
        });

      apiMock.sendCommand
        .mockResolvedValueOnce(
          CommandResultFactory<ApduResponse, Error>({
            data: APDU_RESPONSE_YELD,
          }),
        )
        .mockResolvedValueOnce(
          CommandResultFactory<ApduResponse, Error>({
            data: {
              statusCode: SW_INTERRUPTED_EXECUTION,
              data: new Uint8Array([ClientCommandCodes.GET_PREIMAGE]),
            },
          }),
        )
        .mockResolvedValueOnce(signatureResult);

      const getClientCommandPayloadMock = jest
        .spyOn(ClientCommandInterpreter.prototype, "getClientCommandPayload")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation((request: Uint8Array, context: any) => {
          const commandCode = request[0];
          if (commandCode === ClientCommandCodes.YIELD) {
            // simulate YIELD command
            context.yieldedResults.push(new Uint8Array([]));
            return Right(new Uint8Array([0x00]));
          }
          if (commandCode === ClientCommandCodes.GET_PREIMAGE) {
            // simulate GET_PREIMAGE command
            return Right(PREIMAGE);
          }
          return Left(new ClientCommandHandlerError("error"));
        });

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      // expected number of sendCommand calls:
      // 1. SignMessageCommand
      // 2. ContinueCommand after YIELD
      // 3. ContinueCommand after GET_PREIMAGE
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);

      // check that sendCommand was called with the correct commands
      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          args: {
            derivationPath: DERIVATION_PATH,
            messageLength: new TextEncoder().encode(EXACT_TWO_CHUNKS_MESSAGE)
              .length,
            messageMerkleRoot: MERKLE_ROOT,
          },
        }),
      );

      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          args: {
            payload: new Uint8Array([0x00]),
          },
        }),
      );

      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          args: {
            payload: PREIMAGE,
          },
        }),
      );

      // check the final result
      expect(result.status).toBe(CommandResultStatus.Success);
      if (result.status === CommandResultStatus.Success) {
        expect(result.data).toStrictEqual(SIGNATURE);
      }

      // check that getClientCommandPayload was called correctly
      expect(getClientCommandPayloadMock).toHaveBeenCalledTimes(2);
      expect(getClientCommandPayloadMock).toHaveBeenNthCalledWith(
        1,
        new Uint8Array([ClientCommandCodes.YIELD]),
        expect.any(Object),
      );
      expect(getClientCommandPayloadMock).toHaveBeenNthCalledWith(
        2,
        new Uint8Array([ClientCommandCodes.GET_PREIMAGE]),
        expect.any(Object),
      );
    });

    it("should return an error if the initial SignMessageCommand fails", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_ONE_CHUNK_MESSAGE,
      };

      const resultError = CommandResultFactory<Signature, Error>({
        error: new InvalidStatusWordError("error"),
      });

      jest
        .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
        .mockImplementation((_, chunks) => {
          expect(chunks.length).toBe(1);
          return MERKLE_ROOT;
        });

      apiMock.sendCommand.mockResolvedValueOnce(resultError);

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(CommandResultStatus.Error);
      if (result.status === CommandResultStatus.Error) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should return an error if a ContinueCommand fails during interactive execution", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_TWO_CHUNKS_MESSAGE,
      };

      jest
        .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
        .mockImplementation((_, chunks) => {
          expect(chunks.length).toBe(2);
          return MERKLE_ROOT;
        });

      const resultError = CommandResultFactory<Signature, Error>({
        error: new InvalidStatusWordError("error"),
      });

      apiMock.sendCommand
        .mockResolvedValueOnce(
          CommandResultFactory<ApduResponse, Error>({
            data: APDU_RESPONSE_YELD,
          }),
        )
        .mockResolvedValueOnce(resultError);

      const getClientCommandPayloadMock = jest
        .spyOn(ClientCommandInterpreter.prototype, "getClientCommandPayload")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation((request: Uint8Array, context: any) => {
          const commandCode = request[0];
          if (commandCode === ClientCommandCodes.YIELD) {
            // simulate YIELD command
            context.yieldedResults.push(new Uint8Array([]));
            return Right(new Uint8Array([0x00]));
          }
          // no need GET_PREIMAGE since as it should fail before
          return Left(new ClientCommandHandlerError("error"));
        });

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      // expected number of sendCommand calls:
      // 1. SignMessageCommand
      // 2. ContinueCommand after YIELD (which fails)
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

      // check that sendCommand was called with the correct commands
      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          args: {
            derivationPath: DERIVATION_PATH,
            messageLength: new TextEncoder().encode(EXACT_TWO_CHUNKS_MESSAGE)
              .length,
            messageMerkleRoot: MERKLE_ROOT,
          },
        }),
      );

      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          args: {
            payload: new Uint8Array([0x00]),
          },
        }),
      );

      // check the final result
      expect(result.status).toBe(CommandResultStatus.Error);
      if (result.status === CommandResultStatus.Error) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }

      // check that getClientCommandPayload was called correctly
      expect(getClientCommandPayloadMock).toHaveBeenCalledTimes(1);
      expect(getClientCommandPayloadMock).toHaveBeenNthCalledWith(
        1,
        new Uint8Array([ClientCommandCodes.YIELD]),
        expect.any(Object),
      );
    });
  });
});
