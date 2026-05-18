import {
  type SolanaContextSuccess,
  type SolanaContextSuccessType,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type SolanaMessageNormaliser } from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";

export type ProvideContextDeps = {
  readonly api: InternalApi;
  readonly logger: LoggerPublisherService;
  readonly normaliser: SolanaMessageNormaliser;
  readonly transactionBytes: Uint8Array;
};

export type ProvideContextHandler<T extends SolanaContextSuccessType> = (
  result: SolanaContextSuccess<T>,
  deps: ProvideContextDeps,
) => Promise<void>;
