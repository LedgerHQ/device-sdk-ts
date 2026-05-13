import {
  type ClearSignContextType,
  type SolanaTokenContextSuccess,
} from "@ledgerhq/context-module";
import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

export const provideTokenContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TOKEN
> = async (result: SolanaTokenContextSuccess, { api, logger }) => {
  const {
    payload: tokenMetadataPayload,
    certificate: tokenMetadataCertificate,
  } = result;

  if (!tokenMetadataPayload || !tokenMetadataCertificate) return;

  await loadCertificate(
    api,
    tokenMetadataCertificate,
    "[SignerSolana] provideTokenContext: Failed to send tokenMetadataCertificate to device, latest firmware version required",
  );

  logger.debug("[provideTokenContext] Sending token descriptor");
  await api.sendCommand(
    new ProvideTLVTransactionInstructionDescriptorCommand({
      dataHex: tokenMetadataPayload.solanaTokenDescriptor.data,
      signatureHex: tokenMetadataPayload.solanaTokenDescriptor.signature,
    }),
  );
};
