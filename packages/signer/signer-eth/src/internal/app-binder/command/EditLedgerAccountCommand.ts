// Wire reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py
//   prepare_edit_ledger_account → CLA=0xB0, INS=0x10,
//   P1=SUB_CMD_EDIT_LEDGER_ACCOUNT (0x12), P2=0x00.
// The TLV layout is fixed, so the command builds the payload itself rather
// than delegating to a Task. Unlike RegisterLedgerAccount, errors are mapped
// through CONTACTS_APP_ERRORS so the seed-bound HMAC rejection (SW 0x6982,
// returned by the device *before* any UI) surfaces as the typed
// "registered with a different seed" ContactsCommandError rather than the
// generic ETH "Security status not satisfied" message.
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
  CONTACTS_APP_ERRORS,
  CONTACTS_TLV_TAG,
  contactsCommandErrorFactory,
  type ContactsErrorCodes,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvHex,
  encodeTlvUInt8,
  InvalidStatusWordError,
  packDerivationPath,
  STRUCT_TYPE_EDIT_LEDGER_ACCOUNT,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

export type EditLedgerAccountCommandArgs = {
  /** New account name. */
  readonly name: string;
  /** Current (previous) account name — verified by the device's HMAC proof. */
  readonly oldName: string;
  /** BIP32 path without the leading "m/" (e.g. "44'/60'/0'/0/0"). */
  readonly derivationPath: string;
  readonly chainId: number;
  /**
   * 32-byte HMAC proof from the previous registration (lowercase hex, no 0x).
   * The device re-derives the seed-bound key at `derivationPath` and rejects
   * with SW 0x6982 if this proof was minted under a different seed.
   */
  readonly hmacProofHex: string;
};

export type EditLedgerAccountCommandResponse = {
  /** Freshly rotated 32-byte HMAC proof to persist (lowercase hex, no 0x). */
  readonly hmacProofHex: string;
};

const CLA = 0xb0;
const INS = 0x10;
const P1_EDIT_LEDGER_ACCOUNT = 0x12;
const P2 = 0x00;

const RESPONSE_STRUCT_TYPE = STRUCT_TYPE_EDIT_LEDGER_ACCOUNT;
const HMAC_PROOF_BYTES = 32;

export class EditLedgerAccountCommand
  implements
    Command<
      EditLedgerAccountCommandResponse,
      EditLedgerAccountCommandArgs,
      ContactsErrorCodes
    >
{
  readonly name = "editLedgerAccount";
  readonly args: EditLedgerAccountCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    EditLedgerAccountCommandResponse,
    ContactsErrorCodes
  >(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);

  constructor(args: EditLedgerAccountCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const segments = DerivationPathUtils.splitPath(this.args.derivationPath);
    const pathBytes = packDerivationPath(segments);

    const builder = new ByteArrayBuilder();
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_TYPE,
      STRUCT_TYPE_EDIT_LEDGER_ACCOUNT,
    );
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_VERSION,
      STRUCT_VERSION_VALUE,
    );
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, this.args.name);
    encodeTlvAscii(
      builder,
      CONTACTS_TLV_TAG.PREVIOUS_CONTACT_NAME,
      this.args.oldName,
    );
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, this.args.chainId);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_PROOF, this.args.hmacProofHex);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );

    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1_EDIT_LEDGER_ACCOUNT,
      p2: P2,
    })
      .addBufferToData(builder.build())
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<EditLedgerAccountCommandResponse, ContactsErrorCodes> {
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
