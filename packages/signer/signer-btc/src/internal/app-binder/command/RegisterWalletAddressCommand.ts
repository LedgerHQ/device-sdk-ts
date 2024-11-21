import {
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

export type RegisterWalletAddressCommandArgs = {
  policyNameLength: number;
  policyName: string;
  policyDescriptorTemplateLength: number;
  policyDescriptorTemplateHash: Uint8Array;
  policyKeysLength: number;
  policyKeysMerkleTreeRoot: Uint8Array;
};

type RegisterWalletAddressCommandResponse = {
  walletId: Uint8Array;
  hmac: Uint8Array;
};

const RESPONSE_BUFFER_LENGTH = 32;

export class RegisterWalletAddressCommand
  implements
    Command<
      RegisterWalletAddressCommandResponse,
      RegisterWalletAddressCommandArgs
    >
{
  constructor(private readonly _args: RegisterWalletAddressCommandArgs) {}

  getApdu() {
    const builder = new ApduBuilder({
      cla: 0xe1,
      ins: 0x02,
      p1: 0x00,
      p2: 0x01,
    });
    const {
      policyName,
      policyNameLength,
      policyDescriptorTemplateLength,
      policyDescriptorTemplateHash,
      policyKeysLength,
      policyKeysMerkleTreeRoot,
    } = this._args;

    return (
      builder
        // append policy version
        .add8BitUIntToData(0x02)
        // append policy name length to data
        .add8BitUIntToData(policyNameLength)
        // append wallet name
        .addAsciiStringToData(policyName)
        // append wallet descriptor template length
        .add8BitUIntToData(policyDescriptorTemplateLength)
        // append wallet descriptor hash
        .addBufferToData(policyDescriptorTemplateHash)
        // append number of keys
        .add8BitUIntToData(policyKeysLength)
        // append root of merkle tree of keys
        .addBufferToData(policyKeysMerkleTreeRoot)
        // get apdu
        .build()
    );
  }
  parseResponse(
    response: ApduResponse,
  ): CommandResult<RegisterWalletAddressCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    const walletId = parser.extractFieldByLength(RESPONSE_BUFFER_LENGTH);
    const hmac = parser.extractFieldByLength(RESPONSE_BUFFER_LENGTH);
    if (!walletId || !hmac) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Data mismatch"),
      });
    }
    return CommandResultFactory({
      data: {
        walletId,
        hmac,
      },
    });
  }
}
