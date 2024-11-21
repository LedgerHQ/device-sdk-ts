import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";

import { type CommandHandlerContext } from "./ClientCommandHandlerTypes";
import { GetMoreElementsCommandHandler } from "./GetMoreElementsCommandHandler";

const CMD_CODE = ClientCommandCodes.GET_MORE_ELEMENTS;

describe("GetMoreElementsCommandHandler", () => {
  let handler: GetMoreElementsCommandHandler;
  let context: CommandHandlerContext;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataStore = {} as unknown as jest.Mocked<DataStore>;

    context = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };

    handler = new GetMoreElementsCommandHandler();
  });

  const buildRequest = (cmdCode: number): Uint8Array =>
    new Uint8Array([cmdCode]);

  const createElement = (size: number, fillValue: number): Uint8Array =>
    new Uint8Array(Array(size).fill(fillValue));

  it("should retrieve n elements within the maximum payload size", () => {
    // given

    const request = buildRequest(CMD_CODE);

    const elementSize = 50;
    const n = Math.floor((255 - 1 - 1) / elementSize);
    const elements = Array.from({ length: n }, (_, idx) =>
      createElement(elementSize, 0x10 + idx),
    );

    context.queue = [...elements];

    // when
    const response = handler.execute(request, context);

    // then
    const expectedResponse = new Uint8Array(1 + 1 + n * elementSize);
    expectedResponse[0] = n;
    expectedResponse[1] = elementSize;
    for (let i = 0; i < n; i++) {
      expectedResponse.set(elements[i] as Uint8Array, 2 + i * elementSize);
    }

    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });

  it("should retrieve the maximum number of elements allowed and queue the rest", () => {
    // given

    const request = buildRequest(CMD_CODE);

    const elementSize = 30;
    const maxN = Math.floor((255 - 1 - 1) / elementSize);
    const totalElements = maxN + 5;
    const elements = Array.from({ length: totalElements }, (_, idx) =>
      createElement(elementSize, 0x20 + idx),
    );

    context.queue = [...elements];

    // when
    const response = handler.execute(request, context);

    // then
    const expectedResponse = new Uint8Array(1 + 1 + maxN * elementSize);
    expectedResponse[0] = maxN;
    expectedResponse[1] = elementSize;
    for (let i = 0; i < maxN; i++) {
      expectedResponse.set(elements[i] as Uint8Array, 2 + i * elementSize);
    }

    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(totalElements - maxN);
    for (let i = 0; i < totalElements - maxN; i++) {
      expect(context.queue[i]).toEqual(elements[maxN + i]);
    }
  });

  it("should throw an error for invalid request length (too short)", () => {
    // given
    const invalidRequest = new Uint8Array([]);

    // then
    expect(() => handler.execute(invalidRequest, context)).toThrowError(
      "Invalid GET_MORE_ELEMENTS request length",
    );
    expect(context.queue).toHaveLength(0);
  });

  it("should throw an error for invalid request length (too long)", () => {
    // given

    const invalidRequest = new Uint8Array([CMD_CODE, 0x00]);

    // then
    expect(() => handler.execute(invalidRequest, context)).toThrowError(
      "Invalid GET_MORE_ELEMENTS request length",
    );
    expect(context.queue).toHaveLength(0);
  });

  it("should throw an error when queue is empty", () => {
    // given

    const request = buildRequest(CMD_CODE);

    context.queue = [];

    // then
    expect(() => handler.execute(request, context)).toThrowError(
      "No more elements in queue",
    );
    expect(context.queue).toHaveLength(0);
  });

  it("should throw an error when the first element is undefined", () => {
    // given

    const request = buildRequest(CMD_CODE);

    context.queue = [undefined as unknown as Uint8Array];

    // then
    expect(() => handler.execute(request, context)).toThrowError(
      "Queue is empty",
    );
    expect(context.queue).toHaveLength(1);
  });

  it("should throw an error when elements in queue have varying lengths", () => {
    // given

    const request = buildRequest(CMD_CODE);

    const element1 = createElement(40, 0x30);
    const element2 = createElement(50, 0x31);
    context.queue = [element1, element2];

    // then
    expect(() => handler.execute(request, context)).toThrowError(
      "Elements in queue have varying lengths",
    );
    expect(context.queue).toHaveLength(2);
  });

  it("should handle the case where element size exactly matches the maximum payload size", () => {
    // given

    const request = buildRequest(CMD_CODE);

    const elementSize = 253;
    const elements = [createElement(elementSize, 0x40)];

    context.queue = [...elements];

    // when
    const response = handler.execute(request, context);

    // then
    const expectedResponse = new Uint8Array(1 + 1 + elementSize);
    expectedResponse[0] = 1;
    expectedResponse[1] = elementSize;
    expectedResponse.set(elements[0] as Uint8Array, 2);

    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });

  it("should handle the case where element size exceeds the maximum payload size", () => {
    // given

    const request = buildRequest(CMD_CODE);

    const elementSize = 254;
    const elements = [createElement(elementSize, 0x50)];

    context.queue = [...elements];

    // when
    const response = handler.execute(request, context);

    // then
    const expectedResponse = new Uint8Array([0, elementSize]);

    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(1); // still there
  });

  it("should handle multiple executions correctly", () => {
    // given

    const request = buildRequest(CMD_CODE);

    const elementSize = 60;
    const maxN = Math.floor((255 - 1 - 1) / elementSize);
    const totalElements = 10;
    const elements = Array.from({ length: totalElements }, (_, idx) =>
      createElement(elementSize, 0x60 + idx),
    );

    context.queue = [...elements];

    // then
    for (let i = 0; i < Math.ceil(totalElements / maxN); i++) {
      const previousLength = context.queue.length;
      const expectedN = Math.min(maxN, previousLength);
      const expectedResponse = new Uint8Array(1 + 1 + expectedN * elementSize);
      expectedResponse[0] = expectedN;
      expectedResponse[1] = elementSize;
      for (let j = 0; j < expectedN; j++) {
        expectedResponse.set(
          context.queue[j] as Uint8Array,
          2 + j * elementSize,
        );
      }

      const response = handler.execute(request, context);
      expect(response).toEqual(expectedResponse);
      expect(context.queue).toHaveLength(previousLength - expectedN);
    }

    expect(context.queue).toHaveLength(0);
  });
});
