// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#eip712-filtering
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduResponse,
  type Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-sdk-core";

export enum Eip712FilterType {
  Activation = "activation",
  MessageInfo = "message_info",
  Datetime = "datetime",
  Raw = "raw",
  Amount = "amount",
  Token = "token",
}

export type SendEIP712FilteringCommandArgs =
  | { type: Eip712FilterType.Activation }
  | {
      type: Eip712FilterType.MessageInfo;
      displayName: string;
      filtersCount: number;
      signature: string;
    }
  | { type: Eip712FilterType.Datetime; displayName: string; signature: string }
  | { type: Eip712FilterType.Token; tokenIndex: number; signature: string }
  | { type: Eip712FilterType.Raw; displayName: string; signature: string }
  | {
      type: Eip712FilterType.Amount;
      displayName: string;
      tokenIndex: number;
      signature: string;
    };

const FILTER_TO_P2: Record<Eip712FilterType, number> = {
  [Eip712FilterType.Activation]: 0x00,
  [Eip712FilterType.MessageInfo]: 0x0f,
  [Eip712FilterType.Datetime]: 0xfc,
  [Eip712FilterType.Token]: 0xfd,
  [Eip712FilterType.Amount]: 0xfe,
  [Eip712FilterType.Raw]: 0xff,
};

export class SendEIP712FilteringCommand
  implements Command<void, SendEIP712FilteringCommandArgs>
{
  constructor(private readonly args: SendEIP712FilteringCommandArgs) {}

  getApdu(): Apdu {
    const filteringArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x1e,
      p1: 0x00,
      p2: FILTER_TO_P2[this.args.type],
    };
    const builder = new ApduBuilder(filteringArgs);

    if (this.args.type === Eip712FilterType.MessageInfo) {
      builder
        .encodeInLVFromAscii(this.args.displayName)
        .add8BitUIntToData(this.args.filtersCount)
        .encodeInLVFromHexa(this.args.signature);
    } else if (
      this.args.type === Eip712FilterType.Datetime ||
      this.args.type === Eip712FilterType.Raw
    ) {
      builder
        .encodeInLVFromAscii(this.args.displayName)
        .encodeInLVFromHexa(this.args.signature);
    } else if (
      this.args.type === Eip712FilterType.Token ||
      this.args.type === Eip712FilterType.Amount
    ) {
      if (this.args.type === Eip712FilterType.Amount) {
        builder.encodeInLVFromAscii(this.args.displayName);
      }
      builder
        .add8BitUIntToData(this.args.tokenIndex)
        .encodeInLVFromHexa(this.args.signature);
    }

    return builder.build();
  }

  parseResponse(apduResponse: ApduResponse): CommandResult<void> {
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }
    return CommandResultFactory({ data: undefined });
  }
}
