import { type InternalApi } from "@ledgerhq/device-management-kit";

import {
  GetMerkleLeafIndexCommandHandler,
  GetMerkleLeafProofCommandHandler,
  GetMoreElementsCommandHandler,
  GetPreimageCommandHandler,
  YieldCommandHandler,
} from "@internal/app-binder/command/clientCommandHandlers";
import { type CommandHandler } from "@internal/app-binder/command/clientCommandHandlers/ClientCommandHandlersTypes";
import { type DataStore } from "@internal/data-store/model/DataStore";

import { ClientCommandInterpreter } from "./ClientCommandInterpreter";
import { ClientCommandCodes } from "./constants";

jest.mock("@internal/app-binder/command/clientCommandHandlers", () => ({
  YieldCommandHandler: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
  GetPreimageCommandHandler: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
  GetMerkleLeafProofCommandHandler: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
  GetMerkleLeafIndexCommandHandler: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
  GetMoreElementsCommandHandler: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
}));

describe("ClientCommandInterpreter - Integration Tests", () => {
  let interpreter: ClientCommandInterpreter;
  let mockDataStore: jest.Mocked<DataStore>;
  let mockApi: jest.Mocked<InternalApi>;

  let yieldHandler: YieldCommandHandler;
  let getPreimageHandler: GetPreimageCommandHandler;
  let getMerkleLeafProofHandler: GetMerkleLeafProofCommandHandler;
  let getMerkleLeafIndexHandler: GetMerkleLeafIndexCommandHandler;
  let getMoreElementsHandler: GetMoreElementsCommandHandler;

  let clientCommandsMap: Map<ClientCommandCodes, CommandHandler>;

  beforeEach(() => {
    jest.clearAllMocks();

    yieldHandler = new YieldCommandHandler();
    getPreimageHandler = new GetPreimageCommandHandler();
    getMerkleLeafProofHandler = new GetMerkleLeafProofCommandHandler();
    getMerkleLeafIndexHandler = new GetMerkleLeafIndexCommandHandler();
    getMoreElementsHandler = new GetMoreElementsCommandHandler();

    mockDataStore = {
      getPreimage: jest.fn(),
      getMerkleProof: jest.fn(),
      getMerkleLeafIndex: jest.fn(),
    } as unknown as jest.Mocked<DataStore>;

    clientCommandsMap = new Map<ClientCommandCodes, CommandHandler>([
      [ClientCommandCodes.YIELD, yieldHandler],
      [ClientCommandCodes.GET_PREIMAGE, getPreimageHandler],
      [ClientCommandCodes.GET_MERKLE_LEAF_PROOF, getMerkleLeafProofHandler],
      [ClientCommandCodes.GET_MERKLE_LEAF_INDEX, getMerkleLeafIndexHandler],
      [ClientCommandCodes.GET_MORE_ELEMENTS, getMoreElementsHandler],
    ]);

    mockApi = {
      sendCommand: jest.fn().mockImplementation(async (cmd) => {
        // Return the command itself or an appropriate response
        return cmd;
      }),
    } as unknown as jest.Mocked<InternalApi>;

    interpreter = new ClientCommandInterpreter(
      mockDataStore,
      clientCommandsMap,
    );
  });

  describe("Command Delegation", () => {
    it("should delegate YIELD command to YieldCommandHandler", async () => {
      // given
      const payload = new Uint8Array([0xde, 0xf1, 0xaa]);
      const request = new Uint8Array([ClientCommandCodes.YIELD, ...payload]);

      // spy
      const executespy = jest.spyOn(yieldHandler, "execute");

      // when
      await interpreter.execute(mockApi, request);

      // then
      expect(executespy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_PREIMAGE command to GetPreimageCommandHandler", async () => {
      // given
      const hash = new Uint8Array(32).fill(0xaf);
      const request = new Uint8Array([
        ClientCommandCodes.GET_PREIMAGE,
        0x00,
        ...hash,
      ]);

      // spy
      const executespy = jest.spyOn(getPreimageHandler, "execute");

      // when
      await interpreter.execute(mockApi, request);

      // then
      expect(executespy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_MERKLE_LEAF_PROOF command to GetMerkleLeafProofCommandHandler", async () => {
      // given
      const rootHash = new Uint8Array(32).fill(0xaf);
      const varintN = new Uint8Array([0xde]);
      const varintI = new Uint8Array([0xf1]);
      const request = new Uint8Array([
        ClientCommandCodes.GET_MERKLE_LEAF_PROOF,
        ...rootHash,
        ...varintN,
        ...varintI,
      ]);

      // spy
      const executespy = jest.spyOn(getMerkleLeafProofHandler, "execute");

      // when
      await interpreter.execute(mockApi, request);

      // then
      expect(executespy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_MERKLE_LEAF_INDEX command to GetMerkleLeafIndexCommandHandler", async () => {
      // given
      const rootHash = new Uint8Array(32).fill(0xde);
      const leafHash = new Uint8Array(32).fill(0xf1);
      const request = new Uint8Array([
        ClientCommandCodes.GET_MERKLE_LEAF_INDEX,
        ...rootHash,
        ...leafHash,
      ]);

      // spy
      const executespy = jest.spyOn(getMerkleLeafIndexHandler, "execute");

      // when
      await interpreter.execute(mockApi, request);

      // then
      expect(executespy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_MORE_ELEMENTS command to GetMoreElementsCommandHandler", async () => {
      // given
      const request = new Uint8Array([ClientCommandCodes.GET_MORE_ELEMENTS]);

      // spy
      const executespy = jest.spyOn(getMoreElementsHandler, "execute");

      // when
      await interpreter.execute(mockApi, request);

      // then
      expect(executespy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });
  });

  describe("Unsupported Command", () => {
    it("should throw an error for unsupported command codes", async () => {
      // given
      const unsupportedCode = 0xff;
      const request = new Uint8Array([unsupportedCode, 0xde, 0xf1]);

      // then
      await expect(interpreter.execute(mockApi, request)).rejects.toThrowError(
        `Unexpected command code ${unsupportedCode}`,
      );
    });
  });

  describe("Error Propagation", () => {
    it("should propagate errors thrown by handlers", async () => {
      // given
      const payload = new Uint8Array([0xaa, 0xff, 0xaa]);
      const request = new Uint8Array([ClientCommandCodes.YIELD, ...payload]);

      const handlerError = new Error("Handler failed");
      jest.spyOn(yieldHandler, "execute").mockImplementation(() => {
        throw handlerError;
      });

      // then
      await expect(interpreter.execute(mockApi, request)).rejects.toThrow(
        handlerError,
      );
    });
  });
});
