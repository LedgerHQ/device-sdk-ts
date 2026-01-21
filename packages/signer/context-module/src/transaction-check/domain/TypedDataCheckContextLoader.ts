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
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import {
  TypedData,
  type TypedDataCheckDataSource,
} from "@/transaction-check/data/TypedDataCheckDataSource";
import { transactionCheckTypes } from "@/transaction-check/di/transactionCheckTypes";

export type TypedDataCheckContextInput = {
  from: string;
  data: TypedData;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRANSACTION_CHECK,
];

@injectable()
export class TypedDataCheckContextLoader
  implements ContextLoader<TypedDataCheckContextInput>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(transactionCheckTypes.TypedDataCheckDataSource)
    private typedDataCheckDataSource: TypedDataCheckDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("TypedDataCheckContextLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is TypedDataCheckContextInput {
    const result =
      typeof input === "object" &&
      input !== null &&
      "from" in input &&
      input.from !== undefined &&
      isHexaString(input.from) &&
      input.from !== "0x" &&
      "data" in input &&
      typeof input.data === "object" &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      input.deviceModelId !== DeviceModelId.NANO_S &&
      SUPPORTED_TYPES.every((type) => expectedType.includes(type));

    return result;
  }

  async load(ctx: TypedDataCheckContextInput): Promise<ClearSignContext[]> {
    const { from, data } = ctx;

    if (!from || !data) {
      this.logger.debug("load result", { data: { result: [] } });
      return [];
    }

    const txCheck = await this.typedDataCheckDataSource.getTypedDataCheck({
      data,
      from,
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
