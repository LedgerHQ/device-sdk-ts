// M6 registration is a 2-APDU sequence:
//   1. RegisterLedgerAccount (P1=0x11) via the chunked-framing scheme —
//      on-device approval, returns a 32-byte HMAC proof on the final chunk.
//   2. GetAddressCommand (silent, chainId-framed) — derives and returns the
//      ETH address so the wallet can cache it next to the HMAC proof.
// Both are wrapped by CallTaskInAppDeviceAction in EthAppBinder, matching every
// other action in the package.
//
// Reference: ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md
//   §5.5 register ledger account — tag order STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME, DERIVATION_PATH, CHAIN_ID, BLOCKCHAIN_FAMILY.
import {
  BLOCKCHAIN_FAMILY_ETH,
  ByteArrayBuilder,
  type CommandResult,
  CONTACTS_TLV_TAG,
  DmkResultFactory,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvUInt8,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
  packDerivationPath,
  sendFramedContactsPayload,
  STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type RegisterLedgerAccountArgs,
  type RegisterLedgerAccountResult,
} from "@api/model/RegisterLedgerAccountArgs";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { RegisterLedgerAccountCommand } from "@internal/app-binder/command/RegisterLedgerAccountCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

const SUB_CMD_REGISTER_LEDGER_ACCOUNT = 0x11;

type SendRegisterLedgerAccountTaskArgs = RegisterLedgerAccountArgs & {
  readonly logger: LoggerPublisherService;
};

function stripHexPrefix(hex: string): string {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

export class SendRegisterLedgerAccountTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SendRegisterLedgerAccountTaskArgs,
  ) {
    this._logger = _args.logger;
  }

  async run(): Promise<
    CommandResult<RegisterLedgerAccountResult, EthErrorCodes>
  > {
    this._logger.info("[run] starting RegisterLedgerAccount sequence", {
      tag: "SendRegisterLedgerAccountTask",
      data: {
        name: this._args.name,
        chainId: this._args.chainId,
        derivationPath: this._args.derivationPath,
      },
    });

    const payload = this.buildPayload(this._args);
    const registerResult = (await sendFramedContactsPayload(this._api, {
      payload,
      p1: SUB_CMD_REGISTER_LEDGER_ACCOUNT,
      makeCommand: (chunk, p2) =>
        new RegisterLedgerAccountCommand({ data: chunk, p2 }),
      logger: this._logger,
      commandTag: "SendRegisterLedgerAccountTask",
    })) as CommandResult<{ readonly hmacProofHex?: string }, EthErrorCodes>;

    if (!isSuccessCommandResult(registerResult)) {
      return registerResult;
    }
    if (!registerResult.data.hmacProofHex) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "RegisterLedgerAccount final-chunk response did not carry hmac_proof",
        ),
      });
    }

    const addressResult = await this._api.sendCommand(
      new GetAddressCommand({
        derivationPath: this._args.derivationPath,
        checkOnDevice: false,
        returnChainCode: false,
        chainId: this._args.chainId,
      }),
    );
    if (!isSuccessCommandResult(addressResult)) {
      return addressResult;
    }

    return DmkResultFactory({
      data: {
        hmacProofHex: registerResult.data.hmacProofHex,
        addressHex: stripHexPrefix(addressResult.data.address).toLowerCase(),
      },
    });
  }

  private buildPayload(args: RegisterLedgerAccountArgs): Uint8Array {
    const segments = DerivationPathUtils.splitPath(args.derivationPath);
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
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.name);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );

    return builder.build();
  }
}
