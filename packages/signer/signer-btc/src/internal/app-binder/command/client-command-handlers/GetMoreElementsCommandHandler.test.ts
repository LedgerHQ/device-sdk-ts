import {
  APDU_MAX_PAYLOAD,
  type DmkError,
} from "@ledgerhq/device-management-kit";

import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";

import { type CommandHandlerContext } from "./ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "./Errors";
import { GetMoreElementsCommandHandler } from "./GetMoreElementsCommandHandler";

const COMMAND_CODE = ClientCommandCodes.GET_MORE_ELEMENTS;

describe("GetMoreElementsCommandHandler", () => {
  let commandHandlerContext: CommandHandlerContext;
  let mockDataStore: vi.Mocked<DataStore>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataStore = {} as unknown as vi.Mocked<DataStore>;

    commandHandlerContext = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };
  });

  const buildRequest = (commandCode: number): Uint8Array =>
    new Uint8Array([commandCode]);

  const createElement = (elementSize: number, fillValue: number): Uint8Array =>
    new Uint8Array(Array(elementSize).fill(fillValue));

  it("should retrieve the maximum number of elements within the payload size", () => {
    // given
    const request = buildRequest(COMMAND_CODE);
    const elementSize = 50;
    const maximumElements = Math.floor(
      (APDU_MAX_PAYLOAD - 1 - 1) / elementSize,
    );
    const elements = Array.from({ length: maximumElements }, (_, index) =>
      createElement(elementSize, 0x10 + index),
    );

    // when
    commandHandlerContext.queue = [...elements];

    const response = GetMoreElementsCommandHandler(
      request,
      commandHandlerContext,
    );

    const expectedResponse = new Uint8Array(
      1 + 1 + maximumElements * elementSize,
    );
    expectedResponse[0] = maximumElements;
    expectedResponse[1] = elementSize;
    for (let elementIndex = 0; elementIndex < maximumElements; elementIndex++) {
      expectedResponse.set(
        elements[elementIndex] as Uint8Array,
        2 + elementIndex * elementSize,
      );
    }

    // then
    expect(response.isRight()).toBe(true);
    expect(response.unsafeCoerce()).toEqual(expectedResponse);
    expect(commandHandlerContext.queue).toHaveLength(0);
  });

  it("should retrieve the maximum number of elements allowed and queue the remainder", () => {
    // given
    const request = buildRequest(COMMAND_CODE);
    const elementSize = 30;
    const maximumElements = Math.floor(
      (APDU_MAX_PAYLOAD - 1 - 1) / elementSize,
    );
    const totalElements = maximumElements + 5;
    const elements = Array.from({ length: totalElements }, (_, index) =>
      createElement(elementSize, 0x20 + index),
    );

    // when
    commandHandlerContext.queue = [...elements];

    const response = GetMoreElementsCommandHandler(
      request,
      commandHandlerContext,
    );

    const expectedResponse = new Uint8Array(
      1 + 1 + maximumElements * elementSize,
    );
    expectedResponse[0] = maximumElements;
    expectedResponse[1] = elementSize;
    for (let elementIndex = 0; elementIndex < maximumElements; elementIndex++) {
      expectedResponse.set(
        elements[elementIndex] as Uint8Array,
        2 + elementIndex * elementSize,
      );
    }

    // then
    expect(response.isRight()).toBe(true);
    expect(response.unsafeCoerce()).toEqual(expectedResponse);
    expect(commandHandlerContext.queue).toHaveLength(
      totalElements - maximumElements,
    );
    for (
      let queuedElementIndex = 0;
      queuedElementIndex < commandHandlerContext.queue.length;
      queuedElementIndex++
    ) {
      expect(commandHandlerContext.queue[queuedElementIndex]).toEqual(
        elements[maximumElements + queuedElementIndex],
      );
    }
  });

  it("should return an error when queue is empty", () => {
    // given
    const request = buildRequest(COMMAND_CODE);

    // when
    commandHandlerContext.queue = [];

    const response = GetMoreElementsCommandHandler(
      request,
      commandHandlerContext,
    );

    // then
    expect(response.isLeft()).toBe(true);
    response.caseOf({
      Left: (error: DmkError) => {
        expect(error).toBeInstanceOf(ClientCommandHandlerError);
        expect(commandHandlerContext.queue).toHaveLength(0);
      },
      Right: (_) => {
        throw new Error("Expected Left, got Right");
      },
    });
  });

  it("should return an error when the first element is undefined", () => {
    // given
    const request = buildRequest(COMMAND_CODE);

    // when
    commandHandlerContext.queue = [undefined as unknown as Uint8Array];

    const response = GetMoreElementsCommandHandler(
      request,
      commandHandlerContext,
    );

    // then
    expect(response.isLeft()).toBe(true);
    response.caseOf({
      Left: (error: DmkError) => {
        expect(error).toBeInstanceOf(ClientCommandHandlerError);
        expect(commandHandlerContext.queue).toHaveLength(1);
      },
      Right: (_) => {
        throw new Error("Expected Left, got Right");
      },
    });
  });

  it("should return an error when elements in queue have varying lengths", () => {
    // given
    const request = buildRequest(COMMAND_CODE);
    const firstElement = createElement(40, 0x30);
    const secondElement = createElement(50, 0x31);

    // when
    commandHandlerContext.queue = [firstElement, secondElement];

    const response = GetMoreElementsCommandHandler(
      request,
      commandHandlerContext,
    );

    // then
    expect(response.isLeft()).toBe(true);
    response.caseOf({
      Left: (error: DmkError) => {
        expect(error).toBeInstanceOf(ClientCommandHandlerError);
        expect(commandHandlerContext.queue).toHaveLength(2);
      },
      Right: (_) => {
        throw new Error("Expected Left, got Right");
      },
    });
  });

  it("should handle a single element that matches the maximum payload size", () => {
    // given
    const request = buildRequest(COMMAND_CODE);
    const elementSize = 253;
    const elements = [createElement(elementSize, 0x40)];

    // when
    commandHandlerContext.queue = [...elements];

    const response = GetMoreElementsCommandHandler(
      request,
      commandHandlerContext,
    );

    const expectedResponse = new Uint8Array(1 + 1 + elementSize);
    expectedResponse[0] = 1;
    expectedResponse[1] = elementSize;
    expectedResponse.set(elements[0] as Uint8Array, 2);

    // then
    expect(response.isRight()).toBe(true);
    expect(response.unsafeCoerce()).toEqual(expectedResponse);
    expect(commandHandlerContext.queue).toHaveLength(0);
  });

  it("should handle a single element that exceeds the maximum payload size", () => {
    // given
    const request = buildRequest(COMMAND_CODE);
    const elementSize = 254;
    const elements = [createElement(elementSize, 0x50)];

    // when
    commandHandlerContext.queue = [...elements];

    const response = GetMoreElementsCommandHandler(
      request,
      commandHandlerContext,
    );

    const expectedResponse = new Uint8Array([0, elementSize]);

    // then
    expect(response.isRight()).toBe(true);
    expect(response.unsafeCoerce()).toEqual(expectedResponse);
    expect(commandHandlerContext.queue).toHaveLength(1); // still there
  });

  it("should handle multiple executions correctly", () => {
    // given
    const request = buildRequest(COMMAND_CODE);
    const elementSize = 60;
    const maximumElements = Math.floor(
      (APDU_MAX_PAYLOAD - 1 - 1) / elementSize,
    );
    const totalElements = 10;
    const elements = Array.from({ length: totalElements }, (_, index) =>
      createElement(elementSize, 0x60 + index),
    );

    // when
    commandHandlerContext.queue = [...elements];

    // then
    for (
      let executionIndex = 0;
      executionIndex < Math.ceil(totalElements / maximumElements);
      executionIndex++
    ) {
      const previousQueueLength = commandHandlerContext.queue.length;
      const expectedNumberOfElements = Math.min(
        maximumElements,
        previousQueueLength,
      );
      const expectedResponse = new Uint8Array(
        1 + 1 + expectedNumberOfElements * elementSize,
      );
      expectedResponse[0] = expectedNumberOfElements;
      expectedResponse[1] = elementSize;
      for (
        let elementIndex = 0;
        elementIndex < expectedNumberOfElements;
        elementIndex++
      ) {
        expectedResponse.set(
          commandHandlerContext.queue[elementIndex] as Uint8Array,
          2 + elementIndex * elementSize,
        );
      }

      const response = GetMoreElementsCommandHandler(
        request,
        commandHandlerContext,
      );

      expect(response.isRight()).toBe(true);
      expect(response.unsafeCoerce()).toEqual(expectedResponse);
      expect(commandHandlerContext.queue).toHaveLength(
        previousQueueLength - expectedNumberOfElements,
      );
    }

    expect(commandHandlerContext.queue).toHaveLength(0);
  });
});
