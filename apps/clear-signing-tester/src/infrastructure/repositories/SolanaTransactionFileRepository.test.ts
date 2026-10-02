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
  it("maps rawTx and description, leaving the optional fields undefined", () => {
    const repository = repositoryReading({
      cases: [{ rawTx: "AQABA==", description: "a transfer" }],
    });

    expect(repository.readFromFile("solana.json")).toEqual([
      {
        kind: SignableInputKind.Transaction,
        rawTx: "AQABA==",
        description: "a transfer",
        expectedTexts: undefined,
        unexpectedTexts: undefined,
        expectBlindSigned: undefined,
        skipCraft: undefined,
      },
    ]);
  });

  it("falls back to a numbered description when none is given", () => {
    const repository = repositoryReading({ cases: [{ rawTx: "AQABA==" }] });

    expect(repository.readFromFile("solana.json")[0]!.description).toBe(
      "Transaction 1",
    );
  });

  // The device signs whether or not a descriptor (token, ALT, trusted name)
  // resolved, degrading to the raw account and unscaled amount when it did not.
  // A case that dropped its unexpectedTexts would pass in exactly that situation,
  // so an attack that spoofs a symbol/name/amount could go unnoticed.
  it("carries unexpectedTexts, so a case can assert the spoof is absent", () => {
    const repository = repositoryReading({
      cases: [
        {
          rawTx: "AQABA==",
          expectedTexts: ["0.5", "SOL"],
          unexpectedTexts: ["PYUSD"],
        },
      ],
    });

    const [input] = repository.readFromFile("solana.json");

    expect(input!.expectedTexts).toEqual(["0.5", "SOL"]);
    expect(input!.unexpectedTexts).toEqual(["PYUSD"]);
  });

  it("carries expectBlindSigned, for a case whose point is the blind fallback", () => {
    const repository = repositoryReading({
      cases: [{ rawTx: "AQABA==", expectBlindSigned: true }],
    });

    expect(repository.readFromFile("solana.json")[0]!.expectBlindSigned).toBe(
      true,
    );
  });

  // skipCraft leaves the payer key as authored instead of rewriting it to the
  // device key, for the cases whose signer identity is part of what is tested.
  it("carries skipCraft when set", () => {
    const repository = repositoryReading({
      cases: [{ rawTx: "AQABA==", skipCraft: true }],
    });

    expect(repository.readFromFile("solana.json")[0]!.skipCraft).toBe(true);
  });

  it("rejects a case with no rawTx", () => {
    const repository = repositoryReading({ cases: [{ description: "empty" }] });

    expect(() => repository.readFromFile("solana.json")).toThrow(
      "Transaction at index 0 is missing required field 'rawTx'",
    );
  });
});
