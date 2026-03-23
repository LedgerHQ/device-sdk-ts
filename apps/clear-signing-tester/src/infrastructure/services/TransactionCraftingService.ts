import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { type SolanaTools } from "@ledgerhq/solana-tools";
import { injectable } from "inversify";
import { filter, firstValueFrom, map } from "rxjs";

/**
 * Wraps {@link SolanaTools.craftTransaction} to replace the payer public key
 * in a Solana transaction with the Speculos device's key before signing.
 *
 * Only bound in the Solana DI container.
 */
@injectable()
export class TransactionCraftingService {
  private solanaTools: SolanaTools | null = null;

  setSolanaTools(solanaTools: SolanaTools): void {
    this.solanaTools = solanaTools;
  }

  async craftForDevice(
    derivationPath: string,
    serialisedTransaction: string,
  ): Promise<string> {
    if (!this.solanaTools) {
      throw new Error(
        "SolanaTools not initialized. Call setSolanaTools() first.",
      );
    }

    const { observable } = this.solanaTools.craftTransaction({
      derivationPath,
      serialisedTransaction,
      skipOpenApp: true,
    });

    const result = await firstValueFrom(
      observable.pipe(
        filter(
          (state) =>
            state.status === DeviceActionStatus.Completed ||
            state.status === DeviceActionStatus.Error,
        ),
        map((state) => {
          if (state.status === DeviceActionStatus.Completed) {
            return state.output;
          }
          if (state.status === DeviceActionStatus.Error) {
            throw new Error(
              `Transaction crafting failed: ${JSON.stringify(state.error)}`,
            );
          }
          throw new Error("Unexpected state during transaction crafting");
        }),
      ),
    );

    return result;
  }
}
