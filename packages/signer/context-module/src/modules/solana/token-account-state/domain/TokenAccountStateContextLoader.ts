import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { array, Codec, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type SolanaTokenAccountStatePayload } from "@/modules/solana/model/SolanaPayloads";
import { type TokenAccountStateDataSource } from "@/modules/solana/token-account-state/data/TokenAccountStateDataSource";
import { tokenAccountStateTypes } from "@/modules/solana/token-account-state/di/tokenAccountStateTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { loadChallengeBoundContexts } from "@/shared/utils/challengeBoundLoader";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
];

/**
 * One token-account-state request. The caller must obtain a fresh challenge
 * immediately before fetching each entry.
 */
export type SolanaTokenAccountStateRequest = {
  tokenAccount: string;
  challenge: string;
};

export type SolanaTokenAccountStateContextInput = {
  deviceModelId: DeviceModelId;
  requests: SolanaTokenAccountStateRequest[];
};

const tokenAccountStateRequestCodec = Codec.interface({
  tokenAccount: string,
  challenge: string,
});

const solanaTokenAccountStateInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  requests: array(tokenAccountStateRequestCodec),
});

@injectable()
export class TokenAccountStateContextLoader
  implements ContextLoader<SolanaTokenAccountStateContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(tokenAccountStateTypes.TokenAccountStateDataSource)
    private readonly dataSource: TokenAccountStateDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("TokenAccountStateContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaTokenAccountStateContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) return false;
    return solanaTokenAccountStateInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ requests }) =>
        requests.length > 0 &&
        requests.every(
          (r) => r.tokenAccount.length > 0 && r.challenge.length > 0,
        ),
    });
  }

  public async load(
    input: SolanaTokenAccountStateContextInput,
  ): Promise<ClearSignContext[]> {
    return loadChallengeBoundContexts({
      requests: input.requests,
      deviceModelId: input.deviceModelId,
      certificateLoader: this.certificateLoader,
      logger: this.logger,
      label: "TOKEN_ACCOUNT_STATE",
      fetch: (request) => this.dataSource.getTokenAccountState(request),
      toContext: (value, certificate) => {
        const payload: SolanaTokenAccountStatePayload = {
          descriptor: value.descriptor,
          mint: value.mint,
        };
        return {
          type: ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
          payload,
          certificate,
        };
      },
      describe: (request) => ({ tokenAccount: request.tokenAccount }),
    });
  }
}
