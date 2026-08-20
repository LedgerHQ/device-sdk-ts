// Builds the TLV payload for op 0x11 (Register Ledger Account) and dispatches
// it via the chunked-framing scheme shared with the other address-book ops
// (2-byte BE total length + <=255B chunks). The device returns the 33-byte
// register response (struct_type + hmac_proof) on the final chunk.
//
// Reference: Address Book Final Specifications — Register Ledger Account. Tag
// order: STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME (account name),
// DERIVATION_PATH, CHAIN_ID (Ethereum only), BLOCKCHAIN_FAMILY. Unlike Register
// Identity there is no SCOPE / ACCOUNT_IDENTIFIER and no existing-group
// appendix — the account is derived on-device from DERIVATION_PATH.
import {
  ByteArrayBuilder,
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { RegisterLedgerAccountCommand } from "@internal/app-binder/command/RegisterLedgerAccountCommand";
import {
  BLOCKCHAIN_FAMILY_BY_NAME,
  SUB_CMD_REGISTER_LEDGER_ACCOUNT,
} from "@internal/app-binder/model/contactsConstants";
import { type ContactsErrorCodes } from "@internal/app-binder/model/contactsErrors";
import {
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvUInt8,
  packDerivationPath,
  STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT,
  STRUCT_VERSION_VALUE,
} from "@internal/app-binder/services/contactsTlvSerializer";
import { sendFramedContactsPayload } from "@internal/app-binder/services/sendFramedContactsPayload";

export type RegisterLedgerAccountProof = {
  readonly hmacProof: Uint8Array;
};

export type SendRegisterLedgerAccountTaskArgs = {
  readonly accountName: string;
  readonly derivationPath: string;
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  readonly logger?: LoggerPublisherService;
};

/** Drop an optional leading `m`/`M` segment so splitPath gets numeric parts. */
function stripMasterPrefix(path: string): string {
  const parts = path.split("/");
  if (parts[0] === "m" || parts[0] === "M") {
    return parts.slice(1).join("/");
  }
  return path;
}

export class SendRegisterLedgerAccountTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendRegisterLedgerAccountTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<RegisterLedgerAccountProof, ContactsErrorCodes>
  > {
    const payload = this.buildPayload(this.args);

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_REGISTER_LEDGER_ACCOUNT,
      makeCommand: (chunk, p2) =>
        new RegisterLedgerAccountCommand({ data: chunk, p2 }),
      logger: this.args.logger,
      commandTag: "SendRegisterLedgerAccountTask",
    })) as CommandResult<
      { readonly hmacProof?: Uint8Array },
      ContactsErrorCodes
    >;

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    const { hmacProof } = result.data;
    if (!hmacProof) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "RegisterLedgerAccount final-chunk response did not carry hmac_proof",
        ),
      });
    }
    return DmkResultFactory({ data: { hmacProof } });
  }

  private buildPayload(args: SendRegisterLedgerAccountTaskArgs): Uint8Array {
    const family =
      BLOCKCHAIN_FAMILY_BY_NAME[args.blockchainFamily.toLowerCase()];
    if (family === undefined) {
      throw new Error(
        `Unsupported blockchain family: ${args.blockchainFamily}`,
      );
    }

    const segments = DerivationPathUtils.splitPath(
      stripMasterPrefix(args.derivationPath),
    );
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
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.accountName);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    if (args.chainId !== undefined) {
      encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    }
    encodeTlvUInt8(builder, CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY, family);

    return builder.build();
  }
}
