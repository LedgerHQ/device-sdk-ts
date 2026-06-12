// Wire reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:156-186
//   prepare_register_ledger_account → CLA=0xB0, INS=0x10,
//   P1=SUB_CMD_REGISTER_LEDGER_ACCOUNT (0x11), P2=0x00.
// The TLV layout is fixed (no fresh-vs-extension branching), so the
// command builds the payload itself rather than delegating to a Task.
import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  BLOCKCHAIN_FAMILY_ETH,
  ByteArrayBuilder,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvUInt8,
  InvalidStatusWordError,
  packDerivationPath,
  STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export type RegisterLedgerAccountCommandArgs = {
  readonly name: string;
  /** BIP32 path without the leading "m/" (e.g. "44'/60'/0'/0/0"). */
  readonly derivationPath: string;
  readonly chainId: number;
};

export type RegisterLedgerAccountCommandResponse = {
  readonly hmacProofHex: string;
};

const CLA = 0xb0;
const INS = 0x10;
const P1_REGISTER_LEDGER_ACCOUNT = 0x11;
const P2 = 0x00;

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
    const segments = DerivationPathUtils.splitPath(this.args.derivationPath);
    const pathBytes = packDerivationPath(segments);

    const builder = new ByteArrayBuilder();
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_TYPE,
      STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT,
    );
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_VERSION,
      STRUCT_VERSION_VALUE,
    );
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, this.args.name);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, this.args.chainId);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );

    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1_REGISTER_LEDGER_ACCOUNT,
      p2: P2,
    })
      .addBufferToData(builder.build())
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<RegisterLedgerAccountCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
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
