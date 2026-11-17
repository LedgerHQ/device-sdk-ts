import {
  DeviceModelId,
  getLogger,
  HexaString,
  isHexaString,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import type { TokenDataSource } from "@/modules/ethereum/token/data/TokenDataSource";
import { tokenTypes } from "@/modules/ethereum/token/di/tokenTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export enum ERC20_SUPPORTED_SELECTORS {
  Approve = "0x095ea7b3",
  Transfer = "0xa9059cbb",
}

const SUPPORTED_SELECTORS: HexaString[] = Object.values(
  ERC20_SUPPORTED_SELECTORS,
);

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_TOKEN,
];

export type TokenContextInput = {
  to: HexaString;
  selector: HexaString;
  chainId: number;
  deviceModelId: DeviceModelId;
};

@injectable()
export class TokenContextLoader implements ContextLoader<TokenContextInput> {
  private _dataSource: TokenDataSource;
  private _certificateLoader: PkiCertificateLoader;
  private logger: LoggerPublisherService;

  constructor(
    @inject(tokenTypes.TokenDataSource)
    dataSource: TokenDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    certificateLoader: PkiCertificateLoader,
  ) {
    this._dataSource = dataSource;
    this._certificateLoader = certificateLoader;
    this.logger = getLogger("ContextModule", "TokenContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is TokenContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "to" in input &&
      "selector" in input &&
      "chainId" in input &&
      typeof input.chainId === "number" &&
      isHexaString(input.to) &&
      input.to !== "0x" &&
      isHexaString(input.selector) &&
      this.isSelectorSupported(input.selector) &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: TokenContextInput): Promise<ClearSignContext[]> {
    const { to, chainId, deviceModelId } = input;

    const payload = await this._dataSource.getTokenInfosPayload({
      address: to,
      chainId,
    });

    const certificate = await this._certificateLoader.loadCertificate({
      keyId: KeyId.Erc20MetadataKey,
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: deviceModelId,
    });

    const result = [
      payload.caseOf({
        Left: (error): ClearSignContext => ({
          type: ClearSignContextType.ERROR,
          error,
        }),
        Right: (value): ClearSignContext => ({
          type: ClearSignContextType.ETHEREUM_TOKEN,
          payload: value,
          certificate,
        }),
      }),
    ];

    this.logger.debug("load result", { data: { result } });
    return result;
  }

  private isSelectorSupported(selector: HexaString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
