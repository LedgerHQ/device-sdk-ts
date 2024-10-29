import {
  ByteArrayBuilder,
  CommandResult,
  CommandResultFactory,
  InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { Signature } from "@api/index";
import { TransactionType } from "@api/model/Transaction";
import {
  SignTransactionCommand,
  SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

const PATH_SIZE = 4;

type SendSignTransactionTaskArgs = {
  derivationPath: string;
  serializedTransaction: Uint8Array;
  chainId: number;
  transactionType: TransactionType;
};

export class SendSignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SendSignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, void>> {
    const { derivationPath, serializedTransaction } = this.args;
    const paths = DerivationPathUtils.splitPath(derivationPath);

    const builder = new ByteArrayBuilder(
      serializedTransaction.length + 1 + paths.length * PATH_SIZE,
    );
    // add the derivation paths length
    builder.add8BitUIntToData(paths.length);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });
    // add the transaction
    builder.addBufferToData(serializedTransaction);

    const buffer = builder.build();

    const result =
      await new SendCommandInChunksTask<SignTransactionCommandResponse>(
        this.api,
        {
          data: buffer,
          commandFactory: (args) =>
            new SignTransactionCommand({
              serializedTransaction: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        },
      ).run();

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    return this.recoverSignature(result.data).mapOrDefault(
      (data) => CommandResultFactory({ data }),
      CommandResultFactory({
        error: new InvalidStatusWordError("no signature returned"),
      }),
    );
  }

  private recoverSignature(
    data: SignTransactionCommandResponse,
  ): SignTransactionCommandResponse {
    return data.map(({ v, r, s }) => {
      if (this.args.transactionType !== TransactionType.LEGACY) {
        return { v, r, s };
      }

      // Legacy transactions after EIP-155 has a signature parity formatted as:
      //   V = CHAIN_ID * 2 + 35 + {0,1}
      //     where {0,1} is the parity
      // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md
      //
      // A known issue is present in ethereum app:
      // - chainId is encoded on 32 bits
      // - V is encoded on 8 bits
      // It means both can overflow for big chain IDs.
      //
      // That's why the client has to reconstruct it, to keep APDU backward compatibility
      // for main chain IDs.
      //
      // For more infos:
      // https://github.com/LedgerHQ/app-ethereum/blob/1.12.2/src_features/signTx/ui_common_signTx.c#L36
      // https://github.com/LedgerHQ/app-ethereum/blob/1.12.2/client/src/ledger_app_clients/ethereum/utils.py#L35

      // First truncate the chainId
      const MAX_UINT32 = 0xffffffff;
      let truncatedChainId = this.args.chainId;
      while (truncatedChainId > MAX_UINT32) {
        truncatedChainId = truncatedChainId >> 8;
      }

      // Then truncate the parity encoding
      const MAX_UINT8 = 0xff;
      const v0 = (truncatedChainId * 2 + 35) & MAX_UINT8;

      // Now reconstruct the full V
      const parity = v == v0 ? 0 : 1;
      const fullV = parity + this.args.chainId * 2 + 35;
      return { v: fullV, r, s };
    });
  }
}
