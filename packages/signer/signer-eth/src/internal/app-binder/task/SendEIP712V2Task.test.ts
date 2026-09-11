import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type TypedData } from "@api/model/TypedData";
import { SendEIP712SchemaCommand } from "@internal/app-binder/command/SendEIP712SchemaCommand";
import { SendEIP712ValuesCommand } from "@internal/app-binder/command/SendEIP712ValuesCommand";
import { SignEIP712Command } from "@internal/app-binder/command/SignEIP712Command";
import { DefaultTypedDataParserService } from "@internal/typed-data/service/DefaultTypedDataParserService";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

import { SendEIP712V2Task } from "./SendEIP712V2Task";

const DERIVATION_PATH = "44'/60'/0'/0/0";

const DATA = {
  domain: { name: "Ether Mail" },
  primaryType: "Mail",
  types: {
    EIP712Domain: [{ name: "name", type: "string" }],
    Mail: [{ name: "contents", type: "string" }],
  },
  message: { contents: "Hello, Bob!" },
} as unknown as TypedData;

const PARSED = {
  types: {
    EIP712Domain: {
      name: {
        typeName: "string",
        name: "string",
        size: { isJust: () => false },
      },
    },
  },
  domain: [],
  message: [],
};

const SIGNATURE = {
  v: 0x1c,
  r: `0x${"aa".repeat(32)}`,
  s: `0x${"bb".repeat(32)}`,
};

const parserReturning = (result: unknown): TypedDataParserService =>
  ({
    parse: vi.fn().mockReturnValue(result),
  }) as unknown as TypedDataParserService;

/** Resolves the real struct definitions for the message above. */
const realParser = (): TypedDataParserService =>
  new DefaultTypedDataParserService();

describe("SendEIP712V2Task", () => {
  let api: InternalApi;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      sendCommand: vi.fn(),
    } as unknown as InternalApi;
  });

  it("should send the schema, then the values, then a bare sign command", async () => {
    // GIVEN
    // the sign command is the last one, and the only one returning a signature
    vi.spyOn(api, "sendCommand").mockImplementation(async (command) =>
      command instanceof SignEIP712Command
        ? CommandResultFactory({ data: SIGNATURE })
        : CommandResultFactory({ data: undefined }),
    );

    // WHEN
    const result = await new SendEIP712V2Task(api, {
      derivationPath: DERIVATION_PATH,
      data: DATA,
      parser: realParser(),
    }).run();

    // THEN
    if (!isSuccessCommandResult(result)) {
      throw new Error("Expected a success");
    }
    expect(result.data).toStrictEqual(SIGNATURE);

    const sent = vi.mocked(api.sendCommand).mock.calls.map(([c]) => c);
    expect(sent[0]).toBeInstanceOf(SendEIP712SchemaCommand);
    expect(sent.at(-2)).toBeInstanceOf(SendEIP712ValuesCommand);
    expect(sent.at(-1)).toBeInstanceOf(SignEIP712Command);
  });

  it("should stop at the schema when the app refuses it", async () => {
    // GIVEN
    const error = CommandResultFactory({
      error: new InvalidStatusWordError("schema refused"),
    });
    vi.spyOn(api, "sendCommand").mockResolvedValue(error);

    // WHEN
    const result = await new SendEIP712V2Task(api, {
      derivationPath: DERIVATION_PATH,
      data: DATA,
      parser: realParser(),
    }).run();

    // THEN
    expect(isSuccessCommandResult(result)).toBe(false);
    const sent = vi.mocked(api.sendCommand).mock.calls.map(([c]) => c);
    expect(sent.every((c) => c instanceof SendEIP712SchemaCommand)).toBe(true);
  });

  it("should stop at the values and never sign when the app refuses them", async () => {
    // GIVEN
    vi.spyOn(api, "sendCommand").mockImplementation(async (command) =>
      command instanceof SendEIP712ValuesCommand
        ? CommandResultFactory({
            error: new InvalidStatusWordError("values refused"),
          })
        : CommandResultFactory({ data: undefined }),
    );

    // WHEN
    const result = await new SendEIP712V2Task(api, {
      derivationPath: DERIVATION_PATH,
      data: DATA,
      parser: realParser(),
    }).run();

    // THEN
    expect(isSuccessCommandResult(result)).toBe(false);
    const sent = vi.mocked(api.sendCommand).mock.calls.map(([c]) => c);
    expect(sent.some((c) => c instanceof SignEIP712Command)).toBe(false);
  });

  it("should fail without sending anything when the message cannot be parsed", async () => {
    // GIVEN
    vi.spyOn(api, "sendCommand");

    // WHEN
    const result = await new SendEIP712V2Task(api, {
      derivationPath: DERIVATION_PATH,
      data: DATA,
      parser: parserReturning(Left(new Error("unparseable"))),
    }).run();

    // THEN
    if (isSuccessCommandResult(result)) {
      throw new Error("Expected an error");
    }
    expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    expect(
      (result.error as InvalidStatusWordError).originalError?.message,
    ).toContain("unparseable");
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("should fail without sending anything when the payloads cannot be encoded", async () => {
    // GIVEN a parsed type map that does not declare the primary type
    vi.spyOn(api, "sendCommand");

    // WHEN
    const result = await new SendEIP712V2Task(api, {
      derivationPath: DERIVATION_PATH,
      data: DATA,
      parser: parserReturning(Right({ ...PARSED, types: {} })),
    }).run();

    // THEN
    if (isSuccessCommandResult(result)) {
      throw new Error("Expected an error");
    }
    expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    expect(
      (result.error as InvalidStatusWordError).originalError?.message,
    ).toContain("EIP-712 V2");
    expect(api.sendCommand).not.toHaveBeenCalled();
  });
});
