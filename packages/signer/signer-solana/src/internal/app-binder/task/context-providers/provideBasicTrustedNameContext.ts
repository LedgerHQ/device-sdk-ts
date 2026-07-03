import {
  type ClearSignContextType,
  type SolanaBasicTrustedNameContextSuccess,
} from "@ledgerhq/context-module";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";

import { loadCertificate } from "./loadCertificate";
import { type ProvideContextHandler } from "./provideContextTypes";

/**
 * Sends the basic-flow owner-info `TRUSTED_NAME` (0x21) descriptor as raw
 * bytes, without the 2-byte BE length prefix that the generic clear-signing
 * flow requires. The `signedDescriptor` returned by the owner-info API is
 * already a complete TLV blob; no additional framing is applied here.
 */
export const provideBasicTrustedNameContext: ProvideContextHandler<
  ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME
> = async (result: SolanaBasicTrustedNameContextSuccess, { api, logger }) => {
  const { payload, certificate } = result;
  if (!payload || payload.length === 0) return;

  if (certificate) {
    await loadCertificate(
      api,
      certificate,
      "[SignerSolana] provideBasicTrustedNameContext: failed to load TRUSTED_NAME certificate",
    );
  }

  logger.debug("[provideBasicTrustedNameContext] Sending TRUSTED_NAME");

  await api.sendCommand(new ProvideTLVDescriptorCommand({ payload }));
};
