/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ApduResponse,
  CommandResultFactory,
  CommandResultStatus,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { ClientCommandHandlerError } from "@internal/app-binder/command/client-command-handlers/Errors";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import {
  CHUNK_SIZE,
  ClientCommandCodes,
  SHA256_SIZE,
  SW_INTERRUPTED_EXECUTION,
} from "@internal/app-binder/command/utils/constants";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";

import { SendSignMessageTask } from "./SignMessageTask";

const EXACT_ONE_CHUNK_MESSAGE = "a".repeat(CHUNK_SIZE);
const EXACT_TWO_CHUNKS_MESSAGE = "a".repeat(CHUNK_SIZE * 2);
const DERIVATION_PATH = "44'/0'/0'/0/0";
const PREIMAGE = new Uint8Array([1, 2, 3, 4]);
const MERKLE_ROOT = new Uint8Array(SHA256_SIZE).fill(0x01);

const SIGNATURE: Signature = {
  v: 27,
  r: "0x1212121212121212121212121212121212121212121212121212121212121212",
  s: "0x3434343434343434343434343434343434343434343434343434343434343434",
};

const APDU_RESPONSE_YELD: ApduResponse = {
  statusCode: SW_INTERRUPTED_EXECUTION,
  data: new Uint8Array([ClientCommandCodes.YIELD]),
};

// Helper function to create a mock signature response
const getSignatureResponse = ({
  omitV = false,
  omitR = false,
  omitS = false,
}: {
  omitV?: boolean;
  omitR?: boolean;
  omitS?: boolean;
} = {}) =>
  omitV
    ? new Uint8Array([])
    : new Uint8Array([
        // v
        ...(omitR ? [] : [0x1b]),
        // r (32 bytes) unless omitted
        ...(omitR
          ? []
          : [
              0x97, 0xa4, 0xca, 0x8f, 0x69, 0x46, 0x33, 0x59, 0x26, 0x01, 0xf5,
              0xa2, 0x3e, 0x0b, 0xcc, 0x55, 0x3c, 0x9d, 0x0a, 0x90, 0xd3, 0xa3,
              0x42, 0x2d, 0x57, 0x55, 0x08, 0xa9, 0x28, 0x98, 0xb9, 0x6e,
            ]),
        // s (32 bytes) unless omitted
        ...(omitS
          ? []
          : [
              0x69, 0x50, 0xd0, 0x2e, 0x74, 0xe9, 0xc1, 0x02, 0xc1, 0x64, 0xa2,
              0x25, 0x53, 0x30, 0x82, 0xca, 0xbd, 0xd8, 0x90, 0xef, 0xc4, 0x63,
              0xf6, 0x7f, 0x60, 0xce, 0xfe, 0x8c, 0x3f, 0x87, 0xcf, 0xce,
            ]),
      ]);

const USER_DENIED_STATUS = new Uint8Array([0x69, 0x85]);

describe("SignMessageTask", () => {
  const signatureResult = CommandResultFactory<Signature, void>({
    data: SIGNATURE,
  });
  const apiMock = {
    sendCommand: jest.fn(),
  } as unknown as InternalApi;

  afterEach(() => {
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

      (apiMock.sendCommand as jest.Mock).mockResolvedValueOnce(signatureResult);

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(CommandResultFactory({ data: SIGNATURE }));
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

      (apiMock.sendCommand as jest.Mock).mockResolvedValueOnce(signatureResult);

      // WHEN
      const result = await new SendSignMessageTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(CommandResultFactory({ data: SIGNATURE }));
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

      (apiMock.sendCommand as jest.Mock)
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
      expect(result).toStrictEqual(CommandResultFactory({ data: SIGNATURE }));

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

      const resultError = CommandResultFactory<Signature, void>({
        error: new InvalidStatusWordError("error"),
      });

      jest
        .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
        .mockImplementation((_, chunks) => {
          expect(chunks.length).toBe(1);
          return MERKLE_ROOT;
        });

      (apiMock.sendCommand as jest.Mock).mockResolvedValueOnce(resultError);

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

      const resultError = CommandResultFactory<Signature, void>({
        error: new InvalidStatusWordError("error"),
      });

      (apiMock.sendCommand as jest.Mock)
        .mockResolvedValueOnce(
          CommandResultFactory<ApduResponse, Error>({
            data: APDU_RESPONSE_YELD,
          }),
        )
        .mockResolvedValueOnce(resultError);

      const getClientCommandPayloadMock = jest
        .spyOn(ClientCommandInterpreter.prototype, "getClientCommandPayload")

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

  describe("parseBitcoinSignatureResponse", () => {
    let instance: SendSignMessageTask;

    beforeEach(() => {
      instance = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        message: "test",
      });
    });

    it("should return a continuation response if it's a continue response", () => {
      const apduResponse: ApduResponse = {
        statusCode: SW_INTERRUPTED_EXECUTION,
        data: new Uint8Array([ClientCommandCodes.YIELD]),
      };

      const result = (instance as any).parseBitcoinSignatureResponse(
        apduResponse,
      );
      expect(result.status).toBe(CommandResultStatus.Success);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(apduResponse);
      }
    });

    it("should return a global error if not success and not a known continuation", () => {
      const apduResponse: ApduResponse = {
        statusCode: new Uint8Array([0x6a, 0x80]),
        data: new Uint8Array([]),
      };

      const result = (instance as any).parseBitcoinSignatureResponse(
        apduResponse,
      );
      expect(result.status).toBe(CommandResultStatus.Error);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeDefined();
      }
    });

    it("should return a bitcoin app command error if the error code matches a known bitcoin app error", () => {
      const apduResponse: ApduResponse = {
        statusCode: USER_DENIED_STATUS,
        data: new Uint8Array([]),
      };

      const result = (instance as any).parseBitcoinSignatureResponse(
        apduResponse,
      );
      expect(result.status).toBe(CommandResultStatus.Error);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeDefined();
      }
    });

    it("should return an error if 'v' is missing", () => {
      const apduResponse: ApduResponse = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getSignatureResponse({ omitV: true }),
      };

      const result = (instance as any).parseBitcoinSignatureResponse(
        apduResponse,
      );

      expect(result.status).toBe(CommandResultStatus.Error);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result).toStrictEqual(
          CommandResultFactory({
            error: new InvalidStatusWordError("V is missing"),
          }),
        );
      }
    });

    it("should return an error if 'r' is missing", () => {
      const apduResponse: ApduResponse = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getSignatureResponse({ omitR: true }),
      };

      const result = (instance as any).parseBitcoinSignatureResponse(
        apduResponse,
      );

      expect(result.status).toBe(CommandResultStatus.Error);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result).toStrictEqual(
          CommandResultFactory({
            error: new InvalidStatusWordError("R is missing"),
          }),
        );
      }
    });

    it("should return an error if 's' is missing", () => {
      const apduResponse: ApduResponse = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getSignatureResponse({ omitS: true }),
      };

      const result = (instance as any).parseBitcoinSignatureResponse(
        apduResponse,
      );

      expect(result.status).toBe(CommandResultStatus.Error);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result).toStrictEqual(
          CommandResultFactory({
            error: new InvalidStatusWordError("S is missing"),
          }),
        );
      }
    });

    it("should return a signature if v, r, and s are present", () => {
      const apduResponse: ApduResponse = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: getSignatureResponse(),
      };

      const result = (instance as any).parseBitcoinSignatureResponse(
        apduResponse,
      );

      expect(result.status).toBe(CommandResultStatus.Success);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual({
          v: 27,
          r: "0x97a4ca8f694633592601f5a23e0bcc553c9d0a90d3a3422d575508a92898b96e",
          s: "0x6950d02e74e9c102c164a225533082cabdd890efc463f67f60cefe8c3f87cfce",
        });
      }
    });
  });
});
