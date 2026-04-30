import {
  bufferToHexaString,
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

export type EthereumWeb3CheckContextInput = {
  from: string;
  chainId: number;
  transaction: Uint8Array;
  deviceModelId: DeviceModelId;
  chain?: ContextModuleChainID;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRANSACTION_CHECK,
];

@injectable()
export class EthereumWeb3CheckContextLoader
  implements ContextLoader<EthereumWeb3CheckContextInput>
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
    this.logger = loggerFactory("EthereumWeb3CheckContextLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is EthereumWeb3CheckContextInput {
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
      "chainId" in input &&
      typeof input.chainId === "number" &&
      "transaction" in input &&
      input.transaction !== undefined &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      input.deviceModelId !== DeviceModelId.NANO_S
    );
  }

  async load(ctx: EthereumWeb3CheckContextInput): Promise<ClearSignContext[]> {
    const { from, chainId, transaction } = ctx;

    const rawTx = bufferToHexaString(transaction);

    if (!from || !rawTx) {
      this.logger.debug("load result", { data: { result: [] } });
      return [];
    }

    const txCheck = await this.web3CheckDataSource.check({
      path: EthereumWeb3CheckPath.Transaction,
      body: { tx: { from, raw: rawTx }, chain: chainId },
    });

    const context = await txCheck.caseOf<Promise<ClearSignContext>>({
      Left: (error) =>
        Promise.resolve({
          type: ClearSignContextType.ERROR,
          error,
        }),
      Right: async (data) => {
        const certificate = await this.certificateLoader.loadCertificate({
          keyId: data.publicKeyId,
          keyUsage: KeyUsage.TxSimulationSigner,
          targetDevice: ctx.deviceModelId,
        });

        return {
          type: ClearSignContextType.TRANSACTION_CHECK,
          payload: data.descriptor,
          certificate,
        };
      },
    });

    const result = [context];
    this.logger.debug("load result", { data: { result } });
    return result;
  }
}
