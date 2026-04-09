import {
  SolanaContextTypes,
  type SolanaTokenContextSuccess,
} from "@ledgerhq/context-module";
import {
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";

import { type ProvideContextHandler } from "./provideContextTypes";

export const provideTokenContext: ProvideContextHandler<
  SolanaContextTypes.SOLANA_TOKEN
> = async (result: SolanaTokenContextSuccess, { api, logger }) => {
  const {
    payload: tokenMetadataPayload,
    certificate: tokenMetadataCertificate,
  } = result;

  if (!tokenMetadataPayload || !tokenMetadataCertificate) return;

  const certResult = await api.sendCommand(
    new LoadCertificateCommand({
      certificate: tokenMetadataCertificate.payload,
      keyUsage: tokenMetadataCertificate.keyUsageNumber,
    }),
  );
  if (!isSuccessCommandResult(certResult)) {
    throw new Error(
      "[SignerSolana] provideTokenContext: Failed to send tokenMetadataCertificate to device, latest firmware version required",
    );
  }

  logger.debug("[provideTokenContext] Sending token descriptor");
  await api.sendCommand(
    new ProvideTLVTransactionInstructionDescriptorCommand({
      dataHex: tokenMetadataPayload.solanaTokenDescriptor.data,
      signatureHex: tokenMetadataPayload.solanaTokenDescriptor.signature,
    }),
  );
};
