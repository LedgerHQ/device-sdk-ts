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
): Promise<CommandResult<void, LoadCertificateErrorCodes>> {
  const result = await api.sendCommand(
    new LoadCertificateCommand({
      certificate: certificate.payload,
      keyUsage: certificate.keyUsageNumber,
    }),
  );
  if (!isSuccessCommandResult(result)) {
    logger.error("[loadCertificate] device rejected LOAD_CERTIFICATE", {
      data: { error: result.error },
    });
    return result;
  }
  return CommandResultFactory({ data: undefined });
}
