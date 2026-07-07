import {
  type ClearSignContextType,
  type SolanaTokenInfoContextSuccess,
} from "@ledgerhq/context-module";
import { isSuccessCommandResult } from "@ledgerhq/device-management-kit";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

/** Streams a static `TOKEN_INFO` (0x22) descriptor for a mint. Not chunked. */
export const provideTokenInfoContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TOKEN_INFO
> = async (result: SolanaTokenInfoContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;
  if (!payload) return;

  if (certificate) {
    await loadCertificate(
      api,
      certificate,
      "[SignerSolana] provideTokenInfoContext: failed to load TOKEN_INFO certificate",
    );
  }

  logger.debug("[provideTokenInfoContext] Sending TOKEN_INFO", {
    data: { mint: payload.mint },
  });

  const res = await api.sendCommand(
    new ProvideTLVTransactionInstructionDescriptorCommand({
      dataHex: payload.descriptor.data,
      signatureHex: payload.descriptor.signature,
    }),
  );
  if (!isSuccessCommandResult(res)) {
    throw new Error(
      `[SignerSolana] provideTokenInfoContext: device rejected TOKEN_INFO for mint ${payload.mint}`,
    );
  }
};
