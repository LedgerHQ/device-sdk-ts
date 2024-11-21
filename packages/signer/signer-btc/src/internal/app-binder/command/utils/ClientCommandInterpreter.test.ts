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

    interpreter = new ClientCommandInterpreter(
      mockDataStore,
      clientCommandsMap,
    );
  });

  describe("Command Delegation", () => {
    it("should delegate YIELD command to YieldCommandHandler", () => {
      // Arrange
      const payload = new Uint8Array([0xde, 0xf1, 0xaa]);
      const request = new Uint8Array([ClientCommandCodes.YIELD, ...payload]);

      // spy
      const executeSpy = jest.spyOn(yieldHandler, "execute");

      // when
      interpreter.execute(request);

      // then
      expect(executeSpy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_PREIMAGE command to GetPreimageCommandHandler", () => {
      // Arrange
      const hash = new Uint8Array(32).fill(0xaf);
      const request = new Uint8Array([
        ClientCommandCodes.GET_PREIMAGE,
        0x00,
        ...hash,
      ]);

      // spy
      const executeSpy = jest.spyOn(getPreimageHandler, "execute");

      // when
      interpreter.execute(request);

      // then
      expect(executeSpy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_MERKLE_LEAF_PROOF command to GetMerkleLeafProofCommandHandler", () => {
      // Arrange
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
      const executeSpy = jest.spyOn(getMerkleLeafProofHandler, "execute");

      // when
      interpreter.execute(request);

      // then
      expect(executeSpy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_MERKLE_LEAF_INDEX command to GetMerkleLeafIndexCommandHandler", () => {
      // Arrange
      const rootHash = new Uint8Array(32).fill(0xde);
      const leafHash = new Uint8Array(32).fill(0xf1);
      const request = new Uint8Array([
        ClientCommandCodes.GET_MERKLE_LEAF_INDEX,
        ...rootHash,
        ...leafHash,
      ]);

      // spy
      const executeSpy = jest.spyOn(getMerkleLeafIndexHandler, "execute");

      // when
      interpreter.execute(request);

      // then
      expect(executeSpy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });

    it("should delegate GET_MORE_ELEMENTS command to GetMoreElementsCommandHandler", () => {
      // Arrange
      const request = new Uint8Array([ClientCommandCodes.GET_MORE_ELEMENTS]);

      // spy
      const executeSpy = jest.spyOn(getMoreElementsHandler, "execute");

      // when
      interpreter.execute(request);

      // then
      expect(executeSpy).toHaveBeenCalledWith(request, {
        dataStore: mockDataStore,
        queue: [],
        yieldedResults: [],
      });
    });
  });

  describe("Unsupported Command", () => {
    it("should throw an error for unsupported command codes", () => {
      // Arrange
      const unsupportedCode = 0xff;
      const request = new Uint8Array([unsupportedCode, 0xde, 0xf1]);

      // then
      expect(() => interpreter.execute(request)).toThrowError(
        `Unexpected command code ${unsupportedCode}`,
      );
    });
  });

  describe("Error Propagation", () => {
    it("should propagate errors thrown by handlers", () => {
      // Arrange
      const payload = new Uint8Array([0xaa, 0xff, 0xaa]);
      const request = new Uint8Array([ClientCommandCodes.YIELD, ...payload]);

      const handlerError = new Error("Handler failed");
      jest.spyOn(yieldHandler, "execute").mockImplementation(() => {
        throw handlerError;
      });

      // then
      expect(() => interpreter.execute(request)).toThrow(handlerError);
    });
  });
});
