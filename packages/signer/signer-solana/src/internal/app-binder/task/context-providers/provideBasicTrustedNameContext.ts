import {
  type ClearSignContextType,
  type SolanaBasicTrustedNameContextSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";

import { loadCertificateIfPresent } from "./loadCertificate";
import {
  type ProvideContextErrorCodes,
  type ProvideContextHandler,
} from "./provideContextTypes";

/**
 * Sends the basic-flow owner-info `TRUSTED_NAME` (0x21) descriptor as raw
 * bytes. The `signedDescriptor` returned by the owner-info API is already a
 * complete TLV blob; no additional framing is applied here.
 */
export const provideBasicTrustedNameContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME
> = async (
  result: SolanaBasicTrustedNameContextSuccess,
  { api, logger },
): Promise<CommandResult<void, ProvideContextErrorCodes>> => {
  const { payload, certificate } = result;
  if (!payload || payload.length === 0) {
    return CommandResultFactory({ data: undefined });
  }

  const certResult = await loadCertificateIfPresent(
    api,
    certificate,
    logger,
    "provideBasicTrustedNameContext",
  );
  if (!isSuccessCommandResult(certResult)) {
    return certResult;
  }

  logger.debug("[provideBasicTrustedNameContext] Sending TRUSTED_NAME");

  const res = await api.sendCommand(
    new ProvideTLVDescriptorCommand({ payload }),
  );
  if (!isSuccessCommandResult(res)) {
    logger.error(
      "[provideBasicTrustedNameContext] device rejected BASIC_TRUSTED_NAME",
      { data: { error: res.error } },
    );
    return res;
  }

  return CommandResultFactory({ data: undefined });
};
