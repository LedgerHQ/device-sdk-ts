import {
  bufferToHexaString,
  type DeviceModelId,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { WEB3_CHECKS_EXCLUDED_DEVICE_MODELS } from "@/shared/model/Web3ChecksTypes";
import { type TransactionCheckDataSource } from "@/transaction-check/data/TransactionCheckDataSource";
import { transactionCheckTypes } from "@/transaction-check/di/transactionCheckTypes";

/** Input for Ethereum Web3Checks `POST /ethereum/scan/tx` (hex `from` / RLP `raw`). */
export type EthereumTransactionCheckContextInput = {
  from: string;
  chainId: number;
  transaction: Uint8Array;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRANSACTION_CHECK,
];

@injectable()
export class EthereumTransactionCheckContextLoader
  implements ContextLoader<EthereumTransactionCheckContextInput>
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
    this.logger = loggerFactory("EthereumTransactionCheckContextLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is EthereumTransactionCheckContextInput {
    const result =
      typeof input === "object" &&
      input !== null &&
      "from" in input &&
      input.from !== undefined &&
      isHexaString(input.from) &&
      "chainId" in input &&
      input.chainId !== undefined &&
      typeof input.chainId === "number" &&
      "transaction" in input &&
      input.transaction !== undefined &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      !WEB3_CHECKS_EXCLUDED_DEVICE_MODELS.has(
        input.deviceModelId as DeviceModelId,
      ) &&
      typeof input.chainId === "number" &&
      isHexaString(input.from) &&
      input.from !== "0x" &&
      SUPPORTED_TYPES.every((type) => expectedType.includes(type));
    return result;
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

    const txCheck = await this.transactionCheckDataSource.getTransactionCheck({
      kind: "ethereum",
      chainId,
      rawTx,
      from,
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
