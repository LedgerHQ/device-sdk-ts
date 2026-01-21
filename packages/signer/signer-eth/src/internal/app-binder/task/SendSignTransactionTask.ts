import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { decodeRlp, encodeRlp } from "ethers";
import { Nothing } from "purify-ts";

import { type Signature } from "@api/index";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { TransactionType } from "@api/model/TransactionType";
import {
  SignTransactionCommand,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { StartTransactionCommand } from "@internal/app-binder/command/StartTransactionCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

const PATH_SIZE = 4;

type SendSignTransactionTaskArgs = {
  derivationPath: string;
  serializedTransaction: Uint8Array;
  chainId: number;
  transactionType: TransactionType;
  clearSigningType: ClearSigningType;
  logger?: LoggerPublisherService;
};

export class SendSignTransactionTask {
  private readonly _logger?: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendSignTransactionTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<CommandResult<Signature, EthErrorCodes>> {
    this._logger?.debug("[run] Starting SendSignTransactionTask", {
      data: {
        derivationPath: this.args.derivationPath,
        chainId: this.args.chainId,
        transactionType: this.args.transactionType,
        clearSigningType: this.args.clearSigningType,
        transactionLength: this.args.serializedTransaction.length,
      },
    });

    // For generic-parser transactions, the derivation path and transaction were previously sent
    if (this.args.clearSigningType === ClearSigningType.EIP7730) {
      this._logger?.debug(
        "[run] Using EIP7730 clear signing, starting transaction",
      );
      const signature = await this.api.sendCommand(
        new StartTransactionCommand(),
      );
      if (!isSuccessCommandResult(signature)) {
        this._logger?.error("[run] Failed to start transaction", {
          data: { error: signature.error },
        });
        return signature;
      }
      this._logger?.debug("[run] Transaction signed successfully (EIP7730)");
      return this.recoverSignature(signature.data).mapOrDefault(
        (data) => CommandResultFactory({ data }),
        CommandResultFactory({
          error: new InvalidStatusWordError("no signature returned"),
        }),
      );
    }

    // For other transactions, add derivation path and transaction to the payload
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
    const derivations = builder.build();

    // Send chunks
    const chunks = this.getChunks(derivations, serializedTransaction);
    this._logger?.debug("[run] Sending transaction in chunks", {
      data: { chunksCount: chunks.length },
    });

    let resultData: SignTransactionCommandResponse = Nothing;
    for (let i = 0; i < chunks.length; i++) {
      const result = await this.api.sendCommand(
        new SignTransactionCommand({
          serializedTransaction: chunks[i]!,
          isFirstChunk: i === 0,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        this._logger?.error("[run] Failed to send transaction chunk", {
          data: { chunkIndex: i, error: result.error },
        });
        return result;
      }
      resultData = result.data;
    }

    this._logger?.debug("[run] Transaction signed successfully");
    return this.recoverSignature(resultData).mapOrDefault(
      (data) => CommandResultFactory({ data }),
      CommandResultFactory({
        error: new InvalidStatusWordError("no signature returned"),
      }),
    );
  }

  private getChunks(
    derivations: Uint8Array,
    serializedTransaction: Uint8Array,
  ): Uint8Array[] {
    const buffer = Uint8Array.from([...derivations, ...serializedTransaction]);

    // No chunking for small transactions
    let chunkSize = APDU_MAX_PAYLOAD;
    if (buffer.length <= chunkSize) {
      return [buffer];
    }

    // Since EIP-155, legacy transactions signature encode the chainId in V parity and
    // it has to be part of the hashed transaction:
    // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md
    //
    // A known issue is present in ethereum app for those transactions:
    // if the last chunk start at the EIP-155 marker (the chainId), then the app
    // will confuse it with a pre-eip155 transaction, and compute an invalid signature
    // before receiving the last chunk...
    // It cannot be fixed without breaking APDU backward compatibility.
    //
    // Therefore the client has to make sure the last chunk don't start on that marker.
    if (this.args.transactionType === TransactionType.LEGACY) {
      try {
        // Decode the RLP of the transaction and keep only the last 3 elements (v, r, s)
        const decodedRlp = decodeRlp(serializedTransaction);
        if (Array.isArray(decodedRlp)) {
          const decodedVrs = decodedRlp.slice(-3);
          // Encode those values back to RLP in order to get the length of this serialized list
          // Result should be something like [0xc0 + list payload length, list.map(rlp)]
          // since only v can be used to store the chainId in legacy transactions
          const encodedVrs = encodeRlp(decodedVrs);
          // Since chainIds are uint256, the list payload length can be 1B (v rlp description) + 32B (v) + 1B (r) + 1B (s) = 35B max (< 55B)
          // Therefore, the RLP of this vrs list should be prefixed by a value between [0xc1, 0xe3] (0xc0 + 35B = 0xe3 max)
          // @see https://ethereum.org/en/developers/docs/data-structures-and-encoding/rlp/
          // `encodedVrs` is then everything but the first byte of this serialization
          const encodedVrsBuff = hexaStringToBuffer(encodedVrs)!.subarray(1);

          // Now we search for the biggest chunk value that won't chunk just before the v,r,s values.
          for (
            chunkSize = APDU_MAX_PAYLOAD;
            chunkSize > derivations.length;
            chunkSize--
          ) {
            const lastChunkSize = buffer.length % chunkSize;
            if (lastChunkSize === 0 || lastChunkSize > encodedVrsBuff.length) {
              break;
            }
          }
        }
      } catch (_error) {
        // fallback to "standard" APDU chunk size if the transaction cannot be decoded
        chunkSize = APDU_MAX_PAYLOAD;
      }
    }

    // Finally we can chunk the buffer
    let offset = 0;
    const chunks: Uint8Array[] = [];
    while (offset < buffer.length) {
      chunks.push(buffer.slice(offset, offset + chunkSize));
      offset += chunkSize;
    }
    return chunks;
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
