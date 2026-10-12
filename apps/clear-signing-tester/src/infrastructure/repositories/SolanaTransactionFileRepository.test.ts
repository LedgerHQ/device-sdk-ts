import { describe, expect, it } from "vitest";

import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";

import { SolanaTransactionFileRepository } from "./SolanaTransactionFileRepository";

const repositoryReading = (content: unknown) => {
  const fileReader = {
    readFileSync: () => JSON.stringify(content),
  } as unknown as FileReader;
  const jsonParser = {
    parse: (raw: string) => JSON.parse(raw) as unknown,
  } as unknown as JsonParser;
  return new SolanaTransactionFileRepository(fileReader, jsonParser);
};

describe("SolanaTransactionFileRepository", () => {
  it("reads a case into a transaction input", () => {
    const repository = repositoryReading({
      cases: [{ rawTx: "gAEB", description: "a transfer" }],
    });

    expect(repository.readFromFile("solana.json")).toEqual([
      {
        kind: SignableInputKind.Transaction,
        rawTx: "gAEB",
        description: "a transfer",
      },
    ]);
  });

  // Dropping these would let a case pass or fail on the wrong criteria: a
  // completed signature always satisfies an empty expectation, and a case that
  // is meant to blind-sign counts as a failure unless it says so.
  it("carries the assertions and flags a case declares", () => {
    const repository = repositoryReading({
      cases: [
        {
          rawTx: "gAEB",
          expectedTexts: ["Owner"],
          unexpectedTexts: ["Close"],
          expectBlindSigned: true,
          skipCraft: true,
        },
      ],
    });

    const [input] = repository.readFromFile("solana.json");

    expect(input).toMatchObject({
      expectedTexts: ["Owner"],
      unexpectedTexts: ["Close"],
      expectBlindSigned: true,
      skipCraft: true,
    });
  });

  it("rejects a case with no rawTx", () => {
    const repository = repositoryReading({ cases: [{ description: "empty" }] });

    expect(() => repository.readFromFile("solana.json")).toThrow(
      "Transaction at index 0 is missing required field 'rawTx'",
    );
  });
});
