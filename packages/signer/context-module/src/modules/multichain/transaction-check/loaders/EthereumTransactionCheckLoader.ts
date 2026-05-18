import {
  bufferToHexaString,
  DeviceModelId,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type TransactionCheckDataSource } from "@/modules/multichain/transaction-check/data/TransactionCheckDataSource";
import { transactionCheckTypes } from "@/modules/multichain/transaction-check/di/transactionCheckTypes";
import { type TransactionCheckLoader } from "@/modules/multichain/transaction-check/loaders/TransactionCheckLoader";
import { TransactionCheckPaths } from "@/modules/multichain/transaction-check/utils/constants";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type EthereumTransactionCheckContextInput = {
  from: string;
  chainId: number;
  transaction: Uint8Array;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
];

@injectable()
export class EthereumTransactionCheckLoader
  implements TransactionCheckLoader<EthereumTransactionCheckContextInput>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(transactionCheckTypes.TransactionCheckDataSource)
    private transactionCheckDataSource: TransactionCheckDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("EthereumTransactionCheckLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is EthereumTransactionCheckContextInput {
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
    ctx: EthereumTransactionCheckContextInput,
  ): Promise<ClearSignContext[]> {
    const { from, chainId, transaction } = ctx;

    const rawTx = bufferToHexaString(transaction);

    if (!from || !rawTx) {
      this.logger.debug("load result", { data: { result: [] } });
      return [];
    }

    const txCheck = await this.transactionCheckDataSource.check({
      path: TransactionCheckPaths.ETHEREUM_TRANSACTION,
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
          type: ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
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
