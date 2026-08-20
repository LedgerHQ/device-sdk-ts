import {
  type SolanaContextSuccess,
  type SolanaContextSuccessType,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  type InternalApi,
  type LoadCertificateErrorCodes,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { type SolanaMessageNormaliser } from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

export type ProvideContextDeps = {
  readonly api: InternalApi;
  readonly logger: LoggerPublisherService;
  readonly normaliser: SolanaMessageNormaliser;
  readonly transactionBytes: Uint8Array;
};

export type ProvideContextErrorCodes =
  | SolanaAppErrorCodes
  | LoadCertificateErrorCodes;

export type ProvideContextHandler<T extends SolanaContextSuccessType> = (
  result: SolanaContextSuccess<T>,
  deps: ProvideContextDeps,
) => Promise<CommandResult<void, ProvideContextErrorCodes>>;
