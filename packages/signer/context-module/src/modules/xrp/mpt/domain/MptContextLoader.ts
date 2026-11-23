import { inject, injectable } from "inversify";
import { array, Codec, string } from "purify-ts";

import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type XrpTransactionContext } from "@/modules/xrp/model/XrpTransactionContext";
import { type MptDataSource } from "@/modules/xrp/mpt/data/MptDataSource";
import { mptTypes } from "@/modules/xrp/mpt/di/mptTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [ClearSignContextType.XRP_MPT];

const xrpTransactionContextCodec = Codec.interface({
  mptIssuanceIds: array(string),
  deviceModelId: deviceModelIdCodec,
});

@injectable()
export class MptContextLoader implements ContextLoader<XrpTransactionContext> {
  constructor(
    @inject(mptTypes.MptDataSource)
    private readonly dataSource: MptDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is XrpTransactionContext {
    if (!SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))) {
      return false;
    }
    return xrpTransactionContextCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ mptIssuanceIds }) => mptIssuanceIds.length > 0,
    });
  }

  /**
   * An MPT CAL does not know yields an error context, not a failure: the
   * device then blind signs the transaction or shows it without the ticker.
   */
  async load({
    mptIssuanceIds,
    deviceModelId,
  }: XrpTransactionContext): Promise<ClearSignContext[]> {
    const certificate = await this.certificateLoader.loadCertificate({
      keyId: KeyId.TokenMetadataKey,
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: deviceModelId,
    });

    if (!certificate) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] MptContextLoader: COIN_META certificate is missing",
          ),
        },
      ];
    }

    return Promise.all(
      mptIssuanceIds.map(async (issuanceId) =>
        (await this.dataSource.getMptDescriptor({ issuanceId })).caseOf({
          Left: (error): ClearSignContext => ({
            type: ClearSignContextType.ERROR,
            error,
          }),
          Right: (payload): ClearSignContext => ({
            type: ClearSignContextType.XRP_MPT,
            payload,
            certificate,
          }),
        }),
      ),
    );
  }
}
