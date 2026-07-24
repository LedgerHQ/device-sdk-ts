// Register Ledger Account (register a signer-controlled account) — sub-command
// P1=0x11 of the address-book APDU (CLA 0xB0 / INS 0x10). Caller
// (SendRegisterLedgerAccountTask + sendFramedContactsPayload) assembles the TLV,
// prepends the 2-byte BE total length and slices into ≤255B chunks; this command
// frames one chunk and, on the final chunk, parses the 33-byte response:
// struct_type(0x2f) + hmac_proof(32). Intermediate chunks ack with SW=0x9000
// and no data.
// Protocol: ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md §5.5
import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export type RegisterLedgerAccountCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type RegisterLedgerAccountCommandResponse = {
  /**
   * Present only on the final chunk — struct_type(0x2f) + hmac_proof(32).
   * Intermediate chunks return SW=0x9000 with no data.
   */
  readonly hmacProofHex?: string;
};

const CLA = 0xb0;
const INS = 0x10;
const P1_REGISTER_LEDGER_ACCOUNT = 0x11;

const RESPONSE_STRUCT_TYPE = STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT;
const HMAC_PROOF_BYTES = 32;

export class RegisterLedgerAccountCommand
  implements
    Command<
      RegisterLedgerAccountCommandResponse,
      RegisterLedgerAccountCommandArgs,
      EthErrorCodes
    >
{
  readonly name = "registerLedgerAccount";
  readonly args: RegisterLedgerAccountCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    RegisterLedgerAccountCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(args: RegisterLedgerAccountCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1_REGISTER_LEDGER_ACCOUNT,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<RegisterLedgerAccountCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      if (response.data.length === 0) {
        // Intermediate chunk — device acks with SW=0x9000 and no payload.
        return CommandResultFactory({ data: {} });
      }

      const parser = new ApduParser(response);

      const structType = parser.extract8BitUInt();
      if (structType !== RESPONSE_STRUCT_TYPE) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Expected struct_type 0x${RESPONSE_STRUCT_TYPE.toString(16)}, got ${
              structType === undefined
                ? "undefined"
                : `0x${structType.toString(16)}`
            }`,
          ),
        });
      }

      const hmacProofHex = parser.encodeToHexaString(
        parser.extractFieldByLength(HMAC_PROOF_BYTES),
      );
      if (!hmacProofHex) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_proof missing"),
        });
      }

      return CommandResultFactory({ data: { hmacProofHex } });
    });
  }
}
