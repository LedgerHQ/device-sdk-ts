import {
  DeviceModelId,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import { ContextModuleChainID } from "@/shared/domain/ContextModuleChainID";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type Web3CheckDataSource } from "@/shared/web3-checks/data/Web3CheckDataSource";
import { web3ChecksTypes } from "@/shared/web3-checks/di/web3ChecksTypes";
import { EthereumWeb3CheckPath } from "@/shared/web3-checks/utils/constants";

export type TypedData = {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
    salt?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type EthereumTypedDataCheckContextInput = {
  from: string;
  data: TypedData;
  deviceModelId: DeviceModelId;
  chain?: ContextModuleChainID;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRANSACTION_CHECK,
];

@injectable()
export class EthereumTypedDataCheckContextLoader
  implements ContextLoader<EthereumTypedDataCheckContextInput>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(web3ChecksTypes.Web3CheckDataSource)
    private web3CheckDataSource: Web3CheckDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("EthereumTypedDataCheckContextLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is EthereumTypedDataCheckContextInput {
    if (!SUPPORTED_TYPES.every((type) => expectedType.includes(type)))
      return false;
    if (typeof input !== "object" || input === null) return false;
    if (
      "chain" in input &&
      input.chain !== undefined &&
      input.chain !== ContextModuleChainID.Ethereum
    )
      return false;
    return (
      "from" in input &&
      isHexaString(input.from) &&
      input.from !== "0x" &&
      "data" in input &&
      typeof input.data === "object" &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      input.deviceModelId !== DeviceModelId.NANO_S
    );
  }

  async load(
    ctx: EthereumTypedDataCheckContextInput,
  ): Promise<ClearSignContext[]> {
    const { from, data } = ctx;

    if (!from || !data) {
      this.logger.debug("load result", { data: { result: [] } });
      return [];
    }

    const txCheck = await this.web3CheckDataSource.check({
      path: EthereumWeb3CheckPath.TypedData,
      body: { msg: { from, data } },
    });

    const context = await txCheck.caseOf<Promise<ClearSignContext>>({
      Left: (error) =>
        Promise.resolve({
          type: ClearSignContextType.ERROR,
          error,
        }),
      Right: async (checkResult) => {
        const certificate = await this.certificateLoader.loadCertificate({
          keyId: checkResult.publicKeyId,
          keyUsage: KeyUsage.TxSimulationSigner,
          targetDevice: ctx.deviceModelId,
        });

        return {
          type: ClearSignContextType.TRANSACTION_CHECK,
          payload: checkResult.descriptor,
          certificate,
        };
      },
    });

    const result = [context];
    this.logger.debug("load result", { data: { result } });
    return result;
  }
}
