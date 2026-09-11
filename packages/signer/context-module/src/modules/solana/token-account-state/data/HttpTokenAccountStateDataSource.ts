import {
  DmkNetworkClient,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
import { signedDescriptorDtoCodec } from "@/shared/utils/signedDescriptorDto";

import {
  type GetTokenAccountStateParams,
  type TokenAccountStateDataSource,
  type TokenAccountStateResult,
} from "./TokenAccountStateDataSource";

type TokenAccountStateResponseDto = {
  descriptorType?: string;
  descriptorVersion?: number;
  tokenAccount?: string;
  mint?: string;
  owner?: string;
  preBalance?: number;
  nativePreBalance?: number; // wrappable lamport excess; absent = old backend
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};

@injectable()
export class HttpTokenAccountStateDataSource
  implements TokenAccountStateDataSource
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {
    this.logger = loggerFactory("HttpTokenAccountStateDataSource");
  }

  public async getTokenAccountState({
    tokenAccount,
    challenge,
  }: GetTokenAccountStateParams): Promise<
    Either<Error, TokenAccountStateResult>
  > {
    let dto: TokenAccountStateResponseDto;
    try {
      dto = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/solana/token-account-state/${tokenAccount}`,
        { params: { challenge } },
      )) as TokenAccountStateResponseDto;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Left(
        new Error(
          `[ContextModule] HttpTokenAccountStateDataSource: Failed to fetch token account state: ${reason}`,
        ),
      );
    }

    return signedDescriptorDtoCodec
      .decode(dto)
      .caseOf<Either<Error, TokenAccountStateResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpTokenAccountStateDataSource: malformed response for ${tokenAccount}: ${error}`,
            ),
          ),
        Right: (validated) => {
          if (dto.owner !== undefined && dto.mint === undefined) {
            this.logger.warn(
              "[getTokenAccountState] response has owner but no mint — " +
                "canonical-ATA check will fail and the OWNER binding will be dropped by the device",
              { data: { tokenAccount } },
            );
          }

          let descriptor: Uint8Array;
          try {
            descriptor = HexStringUtils.hexToBytes(validated.signedDescriptor);
          } catch (error) {
            return Left(
              new Error(
                `[ContextModule] HttpTokenAccountStateDataSource: invalid hex in signedDescriptor for ${tokenAccount}: ${(error as Error).message}`,
              ),
            );
          }

          if (dto.nativePreBalance === undefined) {
            this.logger.debug(
              "[getTokenAccountState] nativePreBalance absent in response — native resets will not attest wrappable excess",
              { data: { tokenAccount } },
            );
          }

          return Right({
            tokenAccount,
            descriptor,
            mint: dto.mint,
            keyId: validated.keyId,
            keyUsage: validated.keyUsage,
          });
        },
      });
  }
}
