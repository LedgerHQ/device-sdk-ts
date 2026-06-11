import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
import { signedDescriptorDtoCodec } from "@/shared/utils/signedDescriptorDto";

import {
  type GetSolanaTrustedNameParams,
  type SolanaTrustedNameDataSource,
  type SolanaTrustedNameResult,
} from "./TrustedNameDataSource";

type TrustedNameResponseDto = {
  descriptorType?: string;
  descriptorVersion?: string;
  address?: string;
  name?: string;
  source?: string;
  nameType?: string;
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};

@injectable()
export class HttpSolanaTrustedNameDataSource
  implements SolanaTrustedNameDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getTrustedName({
    address,
    network,
    challenge,
    types,
    sources,
  }: GetSolanaTrustedNameParams): Promise<
    Either<Error, SolanaTrustedNameResult>
  > {
    let dto: TrustedNameResponseDto;
    try {
      dto = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/names/solana/${network}/reverse/${address}`,
        {
          params: {
            types: types.join(","),
            sources: sources.join(","),
            challenge,
          },
        },
      )) as TrustedNameResponseDto;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Left(
        new Error(
          `[ContextModule] HttpSolanaTrustedNameDataSource: Failed to fetch trusted name: ${reason}`,
        ),
      );
    }

    return signedDescriptorDtoCodec
      .decode(dto)
      .caseOf<Either<Error, SolanaTrustedNameResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpSolanaTrustedNameDataSource: malformed response for ${address}: ${error}`,
            ),
          ),
        Right: (validated) => {
          let descriptor: Uint8Array;
          try {
            descriptor = HexStringUtils.hexToBytes(validated.signedDescriptor);
          } catch (error) {
            return Left(
              new Error(
                `[ContextModule] HttpSolanaTrustedNameDataSource: invalid hex in signedDescriptor for ${address}: ${(error as Error).message}`,
              ),
            );
          }

          return Right({
            address,
            descriptor,
            keyId: validated.keyId,
            keyUsage: validated.keyUsage,
          });
        },
      });
  }
}
