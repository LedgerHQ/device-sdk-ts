import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Codec, Either, Left, optional, Right, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import {
  type ContextModuleCalMode,
  type ContextModuleServiceConfig,
} from "@/config/model/ContextModuleConfig";
import { SIGNATURE_TAG } from "@/shared/model/SignatureTags";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

import {
  type GetSolanaTrustedNameParams,
  type SolanaTrustedNameDataSource,
  type SolanaTrustedNameResult,
} from "./TrustedNameDataSource";

const trustedNameResponseCodec = Codec.interface({
  signedDescriptor: Codec.interface({
    data: string,
    signatures: Codec.interface({
      prod: optional(string),
      test: optional(string),
    }),
  }),
  keyId: string,
  keyUsage: string,
});

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
    let dto: unknown;
    try {
      dto = await this.http.get(
        `${this.config.metadataServiceDomain.url}/v2/names/solana/${network}/reverse/${address}`,
        {
          params: {
            types: types.join(","),
            sources: sources.join(","),
            challenge,
          },
        },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Left(
        new Error(
          `[ContextModule] HttpSolanaTrustedNameDataSource: Failed to fetch trusted name: ${reason}`,
        ),
      );
    }

    return trustedNameResponseCodec
      .decode(dto)
      .caseOf<Either<Error, SolanaTrustedNameResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpSolanaTrustedNameDataSource: malformed response for ${address}: ${error}`,
            ),
          ),
        Right: (validated) => {
          const mode: ContextModuleCalMode = this.config.cal.mode ?? "prod";
          const signature = validated.signedDescriptor.signatures[mode];
          if (!signature) {
            return Left(
              new Error(
                `[ContextModule] HttpSolanaTrustedNameDataSource: missing ${mode} signature for ${address}`,
              ),
            );
          }

          let descriptor: Uint8Array;
          try {
            descriptor = HexStringUtils.hexToBytes(
              HexStringUtils.appendSignatureToPayload(
                validated.signedDescriptor.data,
                signature,
                SIGNATURE_TAG,
              ),
            );
          } catch (error) {
            return Left(
              new Error(
                `[ContextModule] HttpSolanaTrustedNameDataSource: invalid signed descriptor for ${address}: ${(error as Error).message}`,
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
