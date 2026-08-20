import { type PkiCertificate } from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
  type LoadCertificateErrorCodes,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

export async function loadCertificate(
  api: InternalApi,
  certificate: PkiCertificate,
  logger: LoggerPublisherService,
  callerTag: string,
): Promise<CommandResult<void, LoadCertificateErrorCodes>> {
  const result = await api.sendCommand(
    new LoadCertificateCommand({
      certificate: certificate.payload,
      keyUsage: certificate.keyUsageNumber,
    }),
  );
  if (!isSuccessCommandResult(result)) {
    logger.error("[loadCertificate] device rejected LOAD_CERTIFICATE", {
      data: {
        caller: callerTag,
        error: result.error,
        keyUsage: certificate.keyUsageNumber,
      },
    });
    return result;
  }
  return CommandResultFactory({ data: undefined });
}

/**
 * Loads the certificate when present, otherwise a no-op success. Every
 * context-provider handler needs exactly this "certificate is optional"
 * gate before streaming its descriptor. `callerTag` identifies the calling
 * provider (e.g. "provideTokenInfoContext") so a rejection log can be traced
 * back to which descriptor flow triggered it.
 */
export async function loadCertificateIfPresent(
  api: InternalApi,
  certificate: PkiCertificate | undefined,
  logger: LoggerPublisherService,
  callerTag: string,
): Promise<CommandResult<void, LoadCertificateErrorCodes>> {
  if (!certificate) {
    return CommandResultFactory({ data: undefined });
  }
  return loadCertificate(api, certificate, logger, callerTag);
}
