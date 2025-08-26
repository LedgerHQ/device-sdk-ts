import { Apdu, ApduBuilder, ApduResponse, CommandResult, CommandResultFactory, type Command } from "@ledgerhq/device-management-kit";
import { CantonAppErrorCodes } from "./utils/CantonApplicationErrors";
import { Signature } from "@api/index";

export class SignTransactionCommand implements Command<Signature, { derivationPath: string; transaction: string }, CantonAppErrorCodes> {
  constructor(private args: { derivationPath: string; transaction: string }) {}

  getCommandName(): string {
    return "SIGN_TRANSACTION";
  }

  getCommandData(): Uint8Array {
    // This would contain the actual command data for the Canton app
    // For now, returning a simple buffer with the derivation path and transaction
    const data = {
      derivationPath: this.args.derivationPath,
      transaction: this.args.transaction,
    };
    const encoder = new TextEncoder();
    return encoder.encode(JSON.stringify(data));
  }

  getApdu(): Apdu {
    const builder = new ApduBuilder({
      cla: 0x00,
      ins: 0x02,
      p1: 0x00,
      p2: 0x00,
    });

    //TODO add data
    const data = this.getCommandData();
    builder.add8BitUIntToData(data.length);
    builder.addBufferToData(data);

    return builder.build();
  }

  parseResponse(_response: ApduResponse): CommandResult<Signature, CantonAppErrorCodes> {
    return CommandResultFactory({
      data: {
        r: "0xtodo",
        s: "0xtodo",
        v: 0,
      } as Signature,
    });
  }
}
