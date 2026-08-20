import {
  type ClearSignContextType,
  type SolanaTokenContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

export const provideTokenContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TOKEN
> = async (
  result: SolanaTokenContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const {
    payload: tokenMetadataPayload,
    certificate: tokenMetadataCertificate,
  } = result;

  if (!tokenMetadataPayload || !tokenMetadataCertificate) {
    return CommandResultFactory({ data: undefined });
  }

  const certResult = await loadCertificateIfPresent(
    api,
    tokenMetadataCertificate,
    logger,
    "provideTokenContext",
  );
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
  }

  logger.debug("[provideTokenContext] Sending token descriptor");
  const res = await api.sendCommand(
    new ProvideTLVTransactionInstructionDescriptorCommand({
      dataHex: tokenMetadataPayload.solanaTokenDescriptor.data,
      signatureHex: tokenMetadataPayload.solanaTokenDescriptor.signature,
    }),
  );
  if (!isSuccessCommandResult(res)) {
    logger.error("[provideTokenContext] device rejected TOKEN descriptor", {
      data: { error: res.error },
    });
    return res;
  }

  return CommandResultFactory({ data: undefined });
};
