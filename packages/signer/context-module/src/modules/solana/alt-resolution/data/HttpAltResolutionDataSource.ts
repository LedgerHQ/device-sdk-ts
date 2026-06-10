import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
import { signedDescriptorDtoCodec } from "@/shared/utils/signedDescriptorDto";
import { u8Codec } from "@/shared/utils/uIntCodec";

import {
  type AltResolutionDataSource,
  type AltResolutionResult,
  type GetAltResolutionParams,
} from "./AltResolutionDataSource";

type AltResolutionResponseDto = {
  descriptorType?: string;
  descriptorVersion?: string;
  alt_address?: string;
  entry_index?: number;
  resolved_address?: string;
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};

@injectable()
export class HttpAltResolutionDataSource implements AltResolutionDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getAltResolution({
    altAddress,
    entryIndex,
    challenge,
  }: GetAltResolutionParams): Promise<Either<Error, AltResolutionResult>> {
    const entryIndexResult = u8Codec.decode(entryIndex);
    if (entryIndexResult.isLeft()) {
      return Left(
        new Error(
          `[ContextModule] HttpAltResolutionDataSource: invalid entryIndex (got ${entryIndex}): ${entryIndexResult.leftOrDefault("")}`,
        ),
      );
    }

    let dto: AltResolutionResponseDto;
    try {
      dto = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/solana/alt-resolution/${altAddress}/${entryIndex}`,
        { params: { challenge } },
      )) as AltResolutionResponseDto;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Left(
        new Error(
          `[ContextModule] HttpAltResolutionDataSource: Failed to fetch ALT resolution: ${reason}`,
        ),
      );
    }

    return signedDescriptorDtoCodec
      .decode(dto)
      .caseOf<Either<Error, AltResolutionResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpAltResolutionDataSource: malformed response for (${altAddress}, ${entryIndex}): ${error}`,
            ),
          ),
        Right: (validated) => {
          let descriptor: Uint8Array;
          try {
            descriptor = HexStringUtils.hexToBytes(validated.signedDescriptor);
          } catch (error) {
            return Left(
              new Error(
                `[ContextModule] HttpAltResolutionDataSource: invalid hex in signedDescriptor for (${altAddress}, ${entryIndex}): ${(error as Error).message}`,
              ),
            );
          }

          return Right({
            altAddress,
            entryIndex,
            descriptor,
            keyId: validated.keyId,
            keyUsage: validated.keyUsage,
          });
        },
      });
  }
}
