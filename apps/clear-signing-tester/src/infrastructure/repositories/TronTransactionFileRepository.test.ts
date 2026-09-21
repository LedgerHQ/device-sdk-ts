import { describe, expect, it } from "vitest";

import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";

import { TronTransactionFileRepository } from "./TronTransactionFileRepository";

const repositoryReading = (content: unknown) => {
  const fileReader = {
    readFileSync: () => JSON.stringify(content),
  } as unknown as FileReader;
  const jsonParser = {
    parse: (raw: string) => JSON.parse(raw) as unknown,
  } as unknown as JsonParser;
  return new TronTransactionFileRepository(fileReader, jsonParser);
};

describe("TronTransactionFileRepository", () => {
  it("passes the raw protobuf hex through untouched", () => {
    const repository = repositoryReading({
      cases: [{ rawTx: "0a023dce", description: "a transfer" }],
    });

    expect(repository.readFromFile("tron.json")).toEqual([
      {
        kind: SignableInputKind.Transaction,
        rawTx: "0a023dce",
        description: "a transfer",
        expectedTexts: undefined,
        unexpectedTexts: undefined,
      },
    ]);
  });

  // The device signs a TRC10 transfer whether or not the token name resolved,
  // showing the raw asset id and unscaled amount when it did not. A case that
  // dropped its unexpectedTexts would pass in exactly that situation.
  it("carries unexpectedTexts, so a case can assert the fallback is absent", () => {
    const repository = repositoryReading({
      cases: [
        {
          rawTx: "0a023dce",
          expectedTexts: ["BitTorrent[1002000]", "1.234567"],
          unexpectedTexts: ["1234567"],
        },
      ],
    });

    const [input] = repository.readFromFile("tron.json");

    expect(input!.expectedTexts).toEqual(["BitTorrent[1002000]", "1.234567"]);
    expect(input!.unexpectedTexts).toEqual(["1234567"]);
  });

  it("rejects a case with no rawTx", () => {
    const repository = repositoryReading({ cases: [{ description: "empty" }] });

    expect(() => repository.readFromFile("tron.json")).toThrow(
      "Transaction at index 0 is missing required field 'rawTx'",
    );
  });
});
