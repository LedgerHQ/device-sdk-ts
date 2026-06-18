// Wire reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py
//   prepare_edit_ledger_account → P1=0x12, struct type 0x30. TLV order:
//   STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME(new), PREVIOUS_CONTACT_NAME(old),
//   DERIVATION_PATH, CHAIN_ID, HMAC_PROOF, BLOCKCHAIN_FAMILY.
import {
  type ApduResponse,
  CommandResultStatus,
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@ledgerhq/device-management-kit";

import { EditLedgerAccountCommand } from "./EditLedgerAccountCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

const HMAC_PROOF_HEX = "ee".repeat(32);

// Edit "Vault" → "Safe", path m/44'/60'/0'/0/0, chainId 1.
const EDIT_REQUEST = hexToBytes(
  [
    "b010120054", // CLA=b0 INS=10 P1=12 P2=00 Lc=0x54
    "010130", // STRUCT_TYPE = 0x30 (edit ledger account)
    "020101", // STRUCT_VERSION = 1
    "81f00453616665", // CONTACT_NAME = "Safe"
    "81f3055661756c74", // PREVIOUS_CONTACT_NAME = "Vault"
    "2115058000002c8000003c800000000000000000000000", // DERIVATION_PATH
    "230101", // CHAIN_ID = 1
    "2920" + HMAC_PROOF_HEX, // HMAC_PROOF (32 bytes)
    "510101", // BLOCKCHAIN_FAMILY = ETH
  ].join(""),
);

const ROTATED_PROOF_HEX = "ab".repeat(32);
const EDIT_RESPONSE_HEX = "30" + ROTATED_PROOF_HEX;

const ARGS = {
  name: "Safe",
  oldName: "Vault",
  derivationPath: "44'/60'/0'/0/0",
  chainId: 1,
  hmacProofHex: HMAC_PROOF_HEX,
};

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("EditLedgerAccountCommand", () => {
  describe("getApdu", () => {
    it("frames the edit payload with P1=0x12 and previous-name + hmac-proof TLVs", () => {
      const command = new EditLedgerAccountCommand(ARGS);

      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(EDIT_REQUEST);
    });
  });

  describe("parseResponse", () => {
    it("extracts the rotated hmac_proof from a successful response", () => {
      const command = new EditLedgerAccountCommand(ARGS);

      const result = command.parseResponse(makeResponse(EDIT_RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacProofHex: ROTATED_PROOF_HEX },
      });
    });

    it("returns an error when struct_type is wrong", () => {
      const wrongType = "ee" + EDIT_RESPONSE_HEX.slice(2);
      const command = new EditLedgerAccountCommand(ARGS);

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps SW=0x6982 to a seed-mismatch ContactsCommandError", () => {
      // The device returns 0x6982 (before showing any UI) only when the
      // seed-bound HMAC proof verification fails — i.e. the Ledger account was
      // registered with a different seed than the one currently connected.
      const command = new EditLedgerAccountCommand(ARGS);

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x82]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
      if (result.status === CommandResultStatus.Error) {
        expect(result.error).toBeInstanceOf(ContactsCommandError);
        expect((result.error as ContactsCommandError).errorCode).toBe(
          CONTACT_SEED_MISMATCH_ERROR_CODE,
        );
      }
    });

    it("maps a known SW (0x6985 user-cancel) to a ContactsCommandError", () => {
      const command = new EditLedgerAccountCommand(ARGS);

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
      if (result.status === CommandResultStatus.Error) {
        expect(result.error).toBeInstanceOf(ContactsCommandError);
      }
    });
  });
});
