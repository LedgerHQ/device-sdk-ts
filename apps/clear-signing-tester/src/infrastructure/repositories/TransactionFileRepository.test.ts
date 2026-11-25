import { describe, expect, it } from "vitest";

import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { type TransactionCrafter } from "@root/src/domain/adapters/TransactionCrafter";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";

import { TransactionFileRepository } from "./TransactionFileRepository";

const repositoryReading = (content: unknown) => {
  const fileReader = {
    readFileSync: () => JSON.stringify(content),
  } as unknown as FileReader;
  const jsonParser = {
    parse: (raw: string) => JSON.parse(raw) as unknown,
  } as unknown as JsonParser;
  const transactionCrafter = {
    unsignRawTransaction: (raw: string) => `unsigned:${raw}`,
  } as unknown as TransactionCrafter;
  return new TransactionFileRepository(
    fileReader,
    jsonParser,
    transactionCrafter,
  );
};

describe("TransactionFileRepository", () => {
  it("signs the unsigned form of the raw transaction", () => {
    const repository = repositoryReading({
      cases: [{ rawTx: "0x02f8", description: "a transfer" }],
    });

    expect(repository.readFromFile("ethereum.json")).toEqual([
      {
        kind: SignableInputKind.Transaction,
        rawTx: "unsigned:0x02f8",
        description: "a transfer",
        expectedTexts: undefined,
        unexpectedTexts: undefined,
        expectBlindSigned: undefined,
      },
    ]);
  });

  // A device that shows a spoofed amount next to the real one still shows every
  // expected text: only the unexpected text catches it.
  it("carries unexpectedTexts, so a case can assert a lie is absent", () => {
    const repository = repositoryReading({
      cases: [
        {
          rawTx: "0x02f8",
          expectedTexts: ["12.5 USDC"],
          unexpectedTexts: ["12500000"],
        },
      ],
    });

    const [input] = repository.readFromFile("ethereum.json");

    expect(input!.expectedTexts).toEqual(["12.5 USDC"]);
    expect(input!.unexpectedTexts).toEqual(["12500000"]);
  });

  it("rejects a case with no rawTx", () => {
    const repository = repositoryReading({ cases: [{ description: "empty" }] });

    expect(() => repository.readFromFile("ethereum.json")).toThrow(
      "Transaction at index 0 is missing required field 'rawTx'",
    );
  });
});
