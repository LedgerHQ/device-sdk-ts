import {
  DeviceModelId,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import type { Eip712V2DescriptorDataSource } from "@/modules/ethereum/typed-data-v2/data/Eip712V2DescriptorDataSource";
import { typedDataV2Types } from "@/modules/ethereum/typed-data-v2/di/typedDataV2Types";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type Eip712V2ContextInput = {
  verifyingContract: string;
  chainId: number;
  /** keccak256(encodeType(primaryType)), the key CAL files the descriptors under */
  primaryTypeHash: string;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
  ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
];

@injectable()
export class Eip712V2ContextLoader
  implements ContextLoader<Eip712V2ContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(typedDataV2Types.Eip712V2DescriptorDataSource)
    private readonly dataSource: Eip712V2DescriptorDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("Eip712V2ContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is Eip712V2ContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "verifyingContract" in input &&
      "chainId" in input &&
      "primaryTypeHash" in input &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      input.deviceModelId !== DeviceModelId.NANO_S &&
      typeof input.chainId === "number" &&
      isHexaString(input.verifyingContract) &&
      isHexaString(input.primaryTypeHash) &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: Eip712V2ContextInput): Promise<ClearSignContext[]> {
    const result = (await this.dataSource.getDescriptors(input)).caseOf<
      ClearSignContext[]
    >({
      Left: (error) => [{ type: ClearSignContextType.ERROR, error }],
      Right: (contexts) => contexts,
    });

    this.logger.debug("load result", { data: { result } });
    return result;
  }
}
