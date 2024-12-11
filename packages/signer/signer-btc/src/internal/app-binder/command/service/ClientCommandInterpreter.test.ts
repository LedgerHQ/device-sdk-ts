import { Left, Right } from "purify-ts";

import { type ClientCommandContext } from "@internal/app-binder/command/client-command-handlers/ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "@internal/app-binder/command/client-command-handlers/Errors";
import * as GetMerkleLeafIndexCommandHandlerModule from "@internal/app-binder/command/client-command-handlers/GetMerkleLeafIndexCommandHandler";
import * as GetMerkleLeafProofCommandHandlerModule from "@internal/app-binder/command/client-command-handlers/GetMerkleLeafProofCommandHandler";
import * as GetMoreElementsCommandHandlerModule from "@internal/app-binder/command/client-command-handlers/GetMoreElementsCommandHandler";
import * as GetPreimageCommandHandlerModule from "@internal/app-binder/command/client-command-handlers/GetPreimageCommandHandler";
import * as YieldCommandHandlerModule from "@internal/app-binder/command/client-command-handlers/YeldCommandHandler";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";

describe("ClientCommandInterpreter", () => {
  let interpreter: ClientCommandInterpreter;
  let context: ClientCommandContext;

  let yieldSpy: jest.SpyInstance;
  let getPreimageSpy: jest.SpyInstance;
  let getMerkleLeafProofSpy: jest.SpyInstance;
  let getMerkleLeafIndexSpy: jest.SpyInstance;
  let getMoreElementsSpy: jest.SpyInstance;

  beforeAll(() => {
    yieldSpy = jest
      .spyOn(YieldCommandHandlerModule, "YieldCommandHandler")
      .mockImplementation((request, ctx) => {
        ctx.yieldedResults.push(request.slice(1));
        return Right(new Uint8Array([]));
      });

    getPreimageSpy = jest
      .spyOn(GetPreimageCommandHandlerModule, "GetPreimageCommandHandler")
      .mockImplementation((_request, ctx) => {
        const preimage = new Uint8Array([1, 2, 3]);
        ctx.dataStore.getPreimage = jest
          .fn()
          .mockReturnValue({ isJust: () => true, extract: () => preimage });
        return Right(preimage);
      });

    getMerkleLeafProofSpy = jest
      .spyOn(
        GetMerkleLeafProofCommandHandlerModule,
        "GetMerkleLeafProofCommandHandler",
      )
      .mockImplementation((_request, _ctx) => {
        return Right(new Uint8Array([]));
      });

    getMerkleLeafIndexSpy = jest
      .spyOn(
        GetMerkleLeafIndexCommandHandlerModule,
        "GetMerkleLeafIndexCommandHandler",
      )
      .mockImplementation((_request, ctx) => {
        ctx.dataStore.getMerkleLeafIndex = jest.fn().mockReturnValue({
          mapOrDefault: (f: (idx: number) => Uint8Array, _def: Uint8Array) =>
            f(42),
        });
        return Right(new Uint8Array([42]));
      });

    getMoreElementsSpy = jest
      .spyOn(
        GetMoreElementsCommandHandlerModule,
        "GetMoreElementsCommandHandler",
      )
      .mockImplementation((_request, ctx) => {
        if (ctx.queue.length === 0) {
          return Left(
            new ClientCommandHandlerError("No more elements in queue"),
          );
        }
        return Right(ctx.queue.shift()!);
      });
  });

  beforeEach(() => {
    interpreter = new ClientCommandInterpreter();
    context = {
      yieldedResults: [],
      dataStore: {
        getPreimage: jest.fn().mockReturnValue({ isJust: () => false }),
        getMerkleLeafIndex: jest.fn(),
      },
      queue: [new Uint8Array([0x01])],
    } as unknown as ClientCommandContext;

    jest.clearAllMocks();
  });

  it("should call YieldCommandHandler when request code is YIELD", () => {
    //given
    const request = new Uint8Array([ClientCommandCodes.YIELD]);

    //when
    interpreter.getClientCommandPayload(request, context);

    //then
    expect(yieldSpy).toHaveBeenCalledTimes(1);
    expect(yieldSpy).toHaveBeenCalledWith(request, context);
  });

  it("should call GetPreimageCommandHandler when request code is GET_PREIMAGE", () => {
    //given
    const request = new Uint8Array([
      ClientCommandCodes.GET_PREIMAGE,
      0x00,
      ...new Uint8Array(32),
    ]);

    //when
    interpreter.getClientCommandPayload(request, context);

    //then
    expect(getPreimageSpy).toHaveBeenCalledTimes(1);
    expect(getPreimageSpy).toHaveBeenCalledWith(request, context);
  });

  it("should call GetMerkleLeafProofCommandHandler when request code is GET_MERKLE_LEAF_PROOF", () => {
    //given
    const request = new Uint8Array([ClientCommandCodes.GET_MERKLE_LEAF_PROOF]);

    //when
    interpreter.getClientCommandPayload(request, context);

    //then
    expect(getMerkleLeafProofSpy).toHaveBeenCalledTimes(1);
    expect(getMerkleLeafProofSpy).toHaveBeenCalledWith(request, context);
  });

  it("should call GetMerkleLeafIndexCommandHandler when request code is GET_MERKLE_LEAF_INDEX", () => {
    //given
    const request = new Uint8Array([
      ClientCommandCodes.GET_MERKLE_LEAF_INDEX,
      ...new Uint8Array(64),
    ]);

    //when
    interpreter.getClientCommandPayload(request, context);

    //then
    expect(getMerkleLeafIndexSpy).toHaveBeenCalledTimes(1);
    expect(getMerkleLeafIndexSpy).toHaveBeenCalledWith(request, context);
  });

  it("should call GetMoreElementsCommandHandler when request code is GET_MORE_ELEMENTS", () => {
    //given
    const request = new Uint8Array([ClientCommandCodes.GET_MORE_ELEMENTS]);

    //when
    interpreter.getClientCommandPayload(request, context);

    //then
    expect(getMoreElementsSpy).toHaveBeenCalledTimes(1);
    expect(getMoreElementsSpy).toHaveBeenCalledWith(request, context);
  });

  it("should return an error for an unknown command code", () => {
    //given
    const invalidCode = 0xff;
    const request = new Uint8Array([invalidCode]);

    //when
    const result = interpreter.getClientCommandPayload(request, context);

    //then
    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(ClientCommandHandlerError);
    expect(yieldSpy).not.toHaveBeenCalled();
    expect(getPreimageSpy).not.toHaveBeenCalled();
    expect(getMerkleLeafProofSpy).not.toHaveBeenCalled();
    expect(getMerkleLeafIndexSpy).not.toHaveBeenCalled();
    expect(getMoreElementsSpy).not.toHaveBeenCalled();
  });

  it("should return an error if no request code is present", () => {
    //giuven
    const emptyRequest = new Uint8Array([]);

    //when
    const result = interpreter.getClientCommandPayload(emptyRequest, context);

    //then
    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(ClientCommandHandlerError);
    expect(yieldSpy).not.toHaveBeenCalled();
    expect(getPreimageSpy).not.toHaveBeenCalled();
    expect(getMerkleLeafProofSpy).not.toHaveBeenCalled();
    expect(getMerkleLeafIndexSpy).not.toHaveBeenCalled();
    expect(getMoreElementsSpy).not.toHaveBeenCalled();
  });
});
