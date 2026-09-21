import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";

import { GetTokenPayloadsTask } from "./GetTokenPayloadsTask";

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

const TRANSACTION = fromHex("0a0100");

describe("GetTokenPayloadsTask", () => {
  const getContextsMock = vi.fn();
  const contextModule = {
    getContexts: getContextsMock,
  } as unknown as ContextModule;

  const run = () =>
    new GetTokenPayloadsTask({ contextModule, transaction: TRANSACTION }).run();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the resolved token descriptors as bytes", async () => {
    // GIVEN the context module resolves a TRC10 token descriptor
    getContextsMock.mockResolvedValue([
      { type: ClearSignContextType.TRON_TOKEN, payload: "aabbcc" },
    ]);

    // WHEN
    const payloads = await run();

    // THEN the transaction is queried for TRON_TOKEN contexts only
    expect(getContextsMock).toHaveBeenCalledWith(
      { rawTransaction: TRANSACTION },
      [ClearSignContextType.TRON_TOKEN],
    );
    expect(payloads).toEqual([fromHex("aabbcc")]);
  });

  it.each([
    ["no context is resolved", []],
    [
      "a context failed to load",
      [{ type: ClearSignContextType.ERROR, error: new Error("boom") }],
    ],
    [
      "a resolved payload is empty",
      [{ type: ClearSignContextType.TRON_TOKEN, payload: "" }],
    ],
    [
      "a resolved payload is not hexadecimal",
      [{ type: ClearSignContextType.TRON_TOKEN, payload: "nothex" }],
    ],
    [
      "more token names are resolved than the app accepts",
      Array.from({ length: 3 }, () => ({
        type: ClearSignContextType.TRON_TOKEN,
        payload: "aabbcc",
      })),
    ],
    [
      "only part of the set resolved",
      [
        { type: ClearSignContextType.TRON_TOKEN, payload: "aabbcc" },
        { type: ClearSignContextType.ERROR, error: new Error("boom") },
      ],
    ],
  ])("provides nothing when %s", async (_case, contexts) => {
    // GIVEN a context set the device could not be trusted to verify
    getContextsMock.mockResolvedValue(contexts);

    // WHEN
    const payloads = await run();

    // THEN the transaction is left to be reviewed without a token name
    expect(payloads).toEqual([]);
  });
});
