import {
  type BtcLegacyErrorCodes,
  type SignerBtcLegacy,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";
import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { BtcLegacyTransactionFileRepository } from "@root/src/infrastructure/repositories/BtcLegacyTransactionFileRepository";

import { BtcLegacySigningService } from "./BtcLegacySigningService";

const repositoryReading = (content: unknown) => {
  const fileReader = {
    readFileSync: () => JSON.stringify(content),
  } as unknown as FileReader;
  const jsonParser = {
    parse: (raw: string) => JSON.parse(raw) as unknown,
  } as unknown as JsonParser;
  return new BtcLegacyTransactionFileRepository(fileReader, jsonParser);
};

const SEGWIT_CASE = {
  description: "a native SegWit Litecoin transaction",
  transaction: {
    inputs: [
      [
        {
          version: "02000000",
          inputs: [{ prevout: "aa", script: "bb", sequence: "ffffffff" }],
          outputs: [{ amount: "0065cd1d00000000", script: "0014" }],
          locktime: "00000000",
        },
        1,
        null,
        4294967293,
      ],
    ],
    associatedKeysets: ["84'/2'/0'/0/0"],
    outputScriptHex: "01c022",
    lockTime: 0,
    segwit: true,
    additionals: ["bech32"],
  },
  expectedTexts: ["LTC"],
};

describe("BtcLegacySigningService", () => {
  it("signs the fixture's transaction with its hex fields as bytes", () => {
    const signTransaction = vi.fn().mockReturnValue({
      observable: new Subject(),
      cancel: vi.fn(),
    });
    const service = new BtcLegacySigningService();
    service.setSigner({
      signTransaction,
    } as unknown as SignerBtcLegacy<BtcLegacyErrorCodes>);

    const [input] = repositoryReading({
      cases: [SEGWIT_CASE],
    }).readFromFile("litecoin.json");
    service.sign(input!);

    expect(signTransaction).toHaveBeenCalledWith(
      {
        inputs: [
          [
            {
              version: Uint8Array.from([0x02, 0x00, 0x00, 0x00]),
              inputs: [
                {
                  prevout: Uint8Array.from([0xaa]),
                  script: Uint8Array.from([0xbb]),
                  sequence: Uint8Array.from([0xff, 0xff, 0xff, 0xff]),
                },
              ],
              outputs: [
                {
                  amount: Uint8Array.from([
                    0x00, 0x65, 0xcd, 0x1d, 0x00, 0x00, 0x00, 0x00,
                  ]),
                  script: Uint8Array.from([0x00, 0x14]),
                },
              ],
              locktime: new Uint8Array(4),
            },
            1,
            null,
            4294967293,
          ],
        ],
        associatedKeysets: ["84'/2'/0'/0/0"],
        outputScriptHex: "01c022",
        lockTime: 0,
        segwit: true,
        additionals: ["bech32"],
      },
      { skipOpenApp: false },
    );
  });

  it("rejects a case with no transaction", () => {
    const repository = repositoryReading({ cases: [{ description: "empty" }] });

    expect(() => repository.readFromFile("litecoin.json")).toThrow(
      "Transaction at index 0 is missing required field 'transaction'",
    );
  });
});
