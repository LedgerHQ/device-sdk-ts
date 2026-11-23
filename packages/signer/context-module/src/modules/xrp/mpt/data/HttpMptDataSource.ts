import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  type GetMptDescriptorParams,
  mptDataResponsesCodec,
  type MptDataSource,
} from "@/modules/xrp/mpt/data/MptDataSource";
import { networkTypes } from "@/shared/network/di/networkTypes";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

/** Tag of the signature field in the Token Dynamic Descriptor. */
const MPT_DESCRIPTOR_SIGNATURE_TAG = "08";

@injectable()
export class HttpMptDataSource implements MptDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  /**
   * CAL matches `token_identifier` on its uppercase hex only. The descriptor
   * has no network field, so a mainnet and a testnet row resolve the same way.
   */
  public async getMptDescriptor({
    issuanceId,
  }: GetMptDescriptorParams): Promise<Either<Error, string>> {
    const noDescriptor = () =>
      Left(
        new Error(
          `[ContextModule] HttpMptDataSource: no MPT descriptor for issuance id ${issuanceId}`,
        ),
      );

    try {
      const response = await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          network_family: "ripple",
          token_identifier: issuanceId.toUpperCase(),
          output: "id,descriptor",
          ref: `branch:${this.config.cal.branch}`,
        },
      });

      return mptDataResponsesCodec.decode(response).caseOf({
        Left: noDescriptor,
        Right: (entries) => {
          const descriptor = entries[0]?.descriptor;
          const signature = descriptor?.signatures[this.config.cal.mode];

          return !descriptor?.data || !signature
            ? noDescriptor()
            : Right(
                HexStringUtils.appendSignatureToPayload(
                  descriptor.data,
                  signature,
                  MPT_DESCRIPTOR_SIGNATURE_TAG,
                ),
              );
        },
      });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpMptDataSource: Failed to fetch the MPT descriptor",
        ),
      );
    }
  }
}
