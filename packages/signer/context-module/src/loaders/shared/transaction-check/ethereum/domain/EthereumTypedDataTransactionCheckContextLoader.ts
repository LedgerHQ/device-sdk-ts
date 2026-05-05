import {
  DeviceModelId,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/loaders/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/loaders/chain-agnostic/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/loaders/chain-agnostic/pki/model/KeyUsage";
import { type TransactionCheckDataSource } from "@/loaders/shared/transaction-check/data/TransactionCheckDataSource";
import { transactionCheckTypes } from "@/loaders/shared/transaction-check/di/transactionCheckTypes";
import { TransactionCheckPaths } from "@/loaders/shared/transaction-check/utils/constants";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

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

export type EthereumTypedDataTransactionCheckContextInput = {
  from: string;
  data: TypedData;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
];

@injectable()
export class EthereumTypedDataTransactionCheckContextLoader
  implements ContextLoader<EthereumTypedDataTransactionCheckContextInput>
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
    this.logger = loggerFactory(
      "EthereumTypedDataTransactionCheckContextLoader",
    );
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is EthereumTypedDataTransactionCheckContextInput {
    if (!SUPPORTED_TYPES.every((type) => expectedType.includes(type)))
      return false;
    if (typeof input !== "object" || input === null) return false;
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
    ctx: EthereumTypedDataTransactionCheckContextInput,
  ): Promise<ClearSignContext[]> {
    const { from, data } = ctx;

    if (!from || !data) {
      this.logger.debug("load result", { data: { result: [] } });
      return [];
    }

    const txCheck = await this.transactionCheckDataSource.check({
      path: TransactionCheckPaths.ETHEREUM_TYPED_DATA,
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
          type: ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
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
