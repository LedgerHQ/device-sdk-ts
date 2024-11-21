import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";

import { type CommandHandlerContext } from "./ClientCommandHandlerTypes";
import { YieldCommandHandler } from "./YeldCommandHandler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDataStore = {} as any;

const CMD_CODE = ClientCommandCodes.YIELD;

describe("YieldCommandHandler", () => {
  let handler: YieldCommandHandler;
  let context: CommandHandlerContext;

  beforeEach(() => {
    handler = new YieldCommandHandler();
    context = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };
  });

  it("should slice the request, push the data to yieldedResults, and return an empty Uint8Array", () => {
    // given
    const payload = new Uint8Array([0x01, 0x02, 0x03]);
    const request = new Uint8Array([CMD_CODE, ...payload]);

    // when
    const result = handler.execute(request, context);

    // then
    expect(context.yieldedResults).toHaveLength(1);
    expect(context.yieldedResults[0]).toEqual(payload);
    expect(result).toEqual(new Uint8Array([]));
  });

  it("should handle empty payload correctly", () => {
    // given
    const payload = new Uint8Array([]);
    const request = new Uint8Array([CMD_CODE, ...payload]);

    // when
    const result = handler.execute(request, context);

    // then
    expect(context.yieldedResults).toHaveLength(1);
    expect(context.yieldedResults[0]).toEqual(payload);
    expect(result).toEqual(new Uint8Array([]));
  });

  it("should handle multiple executions correctly", () => {
    // given
    const payload1 = new Uint8Array([0x01]);
    const payload2 = new Uint8Array([0x02, 0x03]);
    const request1 = new Uint8Array([CMD_CODE, ...payload1]);
    const request2 = new Uint8Array([CMD_CODE, ...payload2]);

    // when
    const result1 = handler.execute(request1, context);
    const result2 = handler.execute(request2, context);

    // then
    expect(context.yieldedResults).toHaveLength(2);
    expect(context.yieldedResults[0]).toEqual(payload1);
    expect(context.yieldedResults[1]).toEqual(payload2);
    expect(result1).toEqual(new Uint8Array([]));
    expect(result2).toEqual(new Uint8Array([]));
  });

  it("should not modify the original request array", () => {
    // given
    const payload = new Uint8Array([0x04, 0x05]);
    const request = new Uint8Array([CMD_CODE, ...payload]);
    const originalRequest = Uint8Array.from(request);

    // when
    handler.execute(request, context);

    // then
    expect(request).toEqual(originalRequest);
  });
});
