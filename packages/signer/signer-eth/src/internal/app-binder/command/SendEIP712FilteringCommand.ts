// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#eip712-filtering
import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export enum Eip712FilterType {
  Activation = "activation",
  DiscardedPath = "discarded_path",
  MessageInfo = "message_info",
  Datetime = "datetime",
  Raw = "raw",
  Amount = "amount",
  Token = "token",
  TrustedName = "trusted-name",
}

export type SendEIP712FilteringCommandArgs =
  | { type: Eip712FilterType.Activation }
  | { type: Eip712FilterType.DiscardedPath; path: string }
  | {
      type: Eip712FilterType.MessageInfo;
      displayName: string;
      filtersCount: number;
      signature: string;
    }
  | {
      type: Eip712FilterType.Datetime;
      discarded: boolean;
      displayName: string;
      signature: string;
    }
  | {
      type: Eip712FilterType.TrustedName;
      discarded: boolean;
      displayName: string;
      typesAndSourcesPayload: string;
      signature: string;
    }
  | {
      type: Eip712FilterType.Token;
      discarded: boolean;
      tokenIndex: number;
      signature: string;
    }
  | {
      type: Eip712FilterType.Raw;
      discarded: boolean;
      displayName: string;
      signature: string;
    }
  | {
      type: Eip712FilterType.Amount;
      discarded: boolean;
      displayName: string;
      tokenIndex: number;
      signature: string;
    };

const FILTER_TO_P2: Record<Eip712FilterType, number> = {
  [Eip712FilterType.Activation]: 0x00,
  [Eip712FilterType.DiscardedPath]: 0x01,
  [Eip712FilterType.MessageInfo]: 0x0f,
  [Eip712FilterType.TrustedName]: 0xfb,
  [Eip712FilterType.Datetime]: 0xfc,
  [Eip712FilterType.Token]: 0xfd,
  [Eip712FilterType.Amount]: 0xfe,
  [Eip712FilterType.Raw]: 0xff,
};

export class SendEIP712FilteringCommand
  implements Command<void, SendEIP712FilteringCommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(readonly args: SendEIP712FilteringCommandArgs) {}

  getApdu(): Apdu {
    const filteringArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x1e,
      p1: "discarded" in this.args && this.args.discarded ? 0x01 : 0x00,
      p2: FILTER_TO_P2[this.args.type],
    };
    const builder = new ApduBuilder(filteringArgs);

    switch (this.args.type) {
      case Eip712FilterType.MessageInfo:
        builder
          .encodeInLVFromAscii(this.args.displayName)
          .add8BitUIntToData(this.args.filtersCount)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case Eip712FilterType.DiscardedPath:
        builder.encodeInLVFromAscii(this.args.path);
        break;
      case Eip712FilterType.Datetime:
      case Eip712FilterType.Raw:
        builder
          .encodeInLVFromAscii(this.args.displayName)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case Eip712FilterType.TrustedName:
        builder
          .encodeInLVFromAscii(this.args.displayName)
          .addHexaStringToData(this.args.typesAndSourcesPayload)
          .encodeInLVFromHexa(this.args.signature);
        break;
      case Eip712FilterType.Token:
      case Eip712FilterType.Amount:
        if (this.args.type === Eip712FilterType.Amount) {
          builder.encodeInLVFromAscii(this.args.displayName);
        }
        builder
          .add8BitUIntToData(this.args.tokenIndex)
          .encodeInLVFromHexa(this.args.signature);
        break;
    }
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: undefined }));
  }
}
