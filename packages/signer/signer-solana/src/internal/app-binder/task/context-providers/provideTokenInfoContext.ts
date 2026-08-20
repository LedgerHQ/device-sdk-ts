import {
  type ClearSignContextType,
  type SolanaTokenInfoContextSuccess,
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

/** Streams a static `TOKEN_INFO` (0x22) descriptor for a mint. Not chunked. */
export const provideTokenInfoContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_TOKEN_INFO
> = async (
  result: SolanaTokenInfoContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const { payload, certificate } = result;
  if (!payload) {
    return CommandResultFactory({ data: undefined });
  }

  const certResult = await loadCertificateIfPresent(
    api,
    certificate,
    logger,
    "provideTokenInfoContext",
  );
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
  }

  logger.debug("[provideTokenInfoContext] Sending TOKEN_INFO", {
    data: { hasMint: !!payload.mint },
  });

  const res = await api.sendCommand(
    new ProvideTLVTransactionInstructionDescriptorCommand({
      dataHex: payload.descriptor.data,
      signatureHex: payload.descriptor.signature,
    }),
  );
  if (!isSuccessCommandResult(res)) {
    logger.error(
      `[provideTokenInfoContext] device rejected TOKEN_INFO for mint ${payload.mint}`,
      { data: { error: res.error } },
    );
    return res;
  }

  return CommandResultFactory({ data: undefined });
};
