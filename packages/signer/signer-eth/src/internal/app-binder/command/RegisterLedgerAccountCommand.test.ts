// Byte-level parity with the playground fixture at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - register_signer_controlled_ledger_account (exchange 1: Register)
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import { RegisterLedgerAccountCommand } from "./RegisterLedgerAccountCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Fixture: register_signer_controlled_ledger_account, exchange 1
// Inputs: name="Vault", path=m/44'/60'/0'/0/0, chainId=1
const VAULT_REQUEST = hexToBytes(
  "b01011002b01012f02010181f0055661756c742115058000002c8000003c800000000000000000000000230101510101",
);

const VAULT_RESPONSE_HEX =
  "2feeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const VAULT_HMAC_PROOF_HEX = "ee".repeat(32);

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("RegisterLedgerAccountCommand", () => {
  describe("getApdu", () => {
    it("frames the register-Vault payload byte-equal to fixture", () => {
      const command = new RegisterLedgerAccountCommand({
        name: "Vault",
        derivationPath: "44'/60'/0'/0/0",
        chainId: 1,
      });

      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(VAULT_REQUEST);
    });
  });

  describe("parseResponse", () => {
    it("extracts hmac_proof from a successful response", () => {
      const command = new RegisterLedgerAccountCommand({
        name: "Vault",
        derivationPath: "44'/60'/0'/0/0",
        chainId: 1,
      });

      const result = command.parseResponse(makeResponse(VAULT_RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacProofHex: VAULT_HMAC_PROOF_HEX },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + VAULT_RESPONSE_HEX.slice(2);
      const command = new RegisterLedgerAccountCommand({
        name: "Vault",
        derivationPath: "44'/60'/0'/0/0",
        chainId: 1,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps a known SW (0x6985 user-cancel) to an EthAppCommandError", () => {
      const command = new RegisterLedgerAccountCommand({
        name: "Vault",
        derivationPath: "44'/60'/0'/0/0",
        chainId: 1,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });
  });
});
