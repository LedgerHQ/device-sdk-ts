import { type DmkError } from "@ledgerhq/device-management-kit";

import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";

import { type CommandHandlerContext } from "./ClientCommandHandlersTypes";
import { YieldCommandHandler } from "./YeldCommandHandler";

const mockDataStore = {} as DataStore;

const COMMAND_CODE = ClientCommandCodes.YIELD;

describe("YieldCommandHandler", () => {
  let commandHandlerContext: CommandHandlerContext;

  beforeEach(() => {
    commandHandlerContext = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };
  });

  it("should slice the request, push the extracted data to yieldedResults, and return an empty Uint8Array", () => {
    // given
    const requestPayload = new Uint8Array([0x01, 0x02, 0x03]);
    const fullRequest = new Uint8Array([COMMAND_CODE, ...requestPayload]);

    // when
    const handlerResult = YieldCommandHandler(
      fullRequest,
      commandHandlerContext,
    );

    // then
    expect(commandHandlerContext.yieldedResults).toHaveLength(1);
    expect(commandHandlerContext.yieldedResults[0]).toEqual(requestPayload);
    handlerResult.caseOf({
      Left: (error: DmkError) => {
        throw new Error(
          `Expected Right, got Left with error: ${error.message}`,
        );
      },
      Right: (response: Uint8Array): void => {
        expect(response).toEqual(new Uint8Array([]));
      },
    });
  });

  it("should handle an empty payload correctly", () => {
    // given
    const emptyPayload = new Uint8Array([]);
    const fullRequest = new Uint8Array([COMMAND_CODE, ...emptyPayload]);

    // when
    const handlerResult = YieldCommandHandler(
      fullRequest,
      commandHandlerContext,
    );

    // then
    expect(commandHandlerContext.yieldedResults).toHaveLength(1);
    expect(commandHandlerContext.yieldedResults[0]).toEqual(emptyPayload);
    handlerResult.caseOf({
      Left: (error: DmkError) => {
        throw new Error(
          `Expected Right, got Left with error: ${error.message}`,
        );
      },
      Right: (response: Uint8Array): void => {
        expect(response).toEqual(new Uint8Array([]));
      },
    });
  });

  it("should handle multiple executions and store results correctly in yieldedResults", () => {
    // given
    const firstPayload = new Uint8Array([0x01]);
    const secondPayload = new Uint8Array([0x02, 0x03]);
    const firstRequest = new Uint8Array([COMMAND_CODE, ...firstPayload]);
    const secondRequest = new Uint8Array([COMMAND_CODE, ...secondPayload]);

    // when
    const firstHandlerResult = YieldCommandHandler(
      firstRequest,
      commandHandlerContext,
    );
    const secondHandlerResult = YieldCommandHandler(
      secondRequest,
      commandHandlerContext,
    );

    // then
    expect(commandHandlerContext.yieldedResults).toHaveLength(2);
    expect(commandHandlerContext.yieldedResults[0]).toEqual(firstPayload);
    expect(commandHandlerContext.yieldedResults[1]).toEqual(secondPayload);
    firstHandlerResult.caseOf({
      Left: (error: DmkError): void => {
        throw new Error(
          `Expected Right, got Left with error: ${error.message}`,
        );
      },
      Right: (response: Uint8Array): void => {
        expect(response).toEqual(new Uint8Array([]));
      },
    });
    secondHandlerResult.caseOf({
      Left: (error: DmkError) => {
        throw new Error(
          `Expected Right, got Left with error: ${error.message}`,
        );
      },
      Right: (response: Uint8Array): void => {
        expect(response).toEqual(new Uint8Array([]));
      },
    });
  });

  it("should not modify the original request array", () => {
    // given
    const requestPayload = new Uint8Array([0x04, 0x05]);
    const fullRequest = new Uint8Array([COMMAND_CODE, ...requestPayload]);
    const originalRequestCopy = Uint8Array.from(fullRequest);

    // when
    YieldCommandHandler(fullRequest, commandHandlerContext);

    // then
    expect(fullRequest).toEqual(originalRequestCopy);
  });
});
