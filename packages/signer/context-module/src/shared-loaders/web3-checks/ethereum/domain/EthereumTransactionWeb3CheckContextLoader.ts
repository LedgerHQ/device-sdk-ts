import {
  bufferToHexaString,
  DeviceModelId,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/chain-agnostic-loaders/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/chain-agnostic-loaders/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/chain-agnostic-loaders/pki/model/KeyUsage";
import { configTypes } from "@/config/di/configTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type Web3CheckDataSource } from "@/shared-loaders/web3-checks/data/Web3CheckDataSource";
import { web3ChecksTypes } from "@/shared-loaders/web3-checks/di/web3ChecksTypes";
import { Web3CheckPaths } from "@/shared-loaders/web3-checks/utils/constants";

export type EthereumTransactionWeb3CheckContextInput = {
  from: string;
  chainId: number;
  transaction: Uint8Array;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_WEB3_CHECK,
];

@injectable()
export class EthereumTransactionWeb3CheckContextLoader
  implements ContextLoader<EthereumTransactionWeb3CheckContextInput>
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
    this.logger = loggerFactory("EthereumTransactionWeb3CheckContextLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is EthereumTransactionWeb3CheckContextInput {
    if (!SUPPORTED_TYPES.every((type) => expectedType.includes(type)))
      return false;
    if (typeof input !== "object" || input === null) return false;
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

  async load(
    ctx: EthereumTransactionWeb3CheckContextInput,
  ): Promise<ClearSignContext[]> {
    const { from, chainId, transaction } = ctx;

    const rawTx = bufferToHexaString(transaction);

    if (!from || !rawTx) {
      this.logger.debug("load result", { data: { result: [] } });
      return [];
    }

    const txCheck = await this.web3CheckDataSource.check({
      path: Web3CheckPaths.ETHEREUM_TRANSACTION,
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
          type: ClearSignContextType.ETHEREUM_WEB3_CHECK,
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
