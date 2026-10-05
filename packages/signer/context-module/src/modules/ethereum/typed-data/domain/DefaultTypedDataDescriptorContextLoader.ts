import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import type {
  TypedDataDescriptorClearSignContext,
  TypedDataDescriptorContext,
} from "@/modules/ethereum/model/TypedDataDescriptorContext";
import type { TokenDataSource } from "@/modules/ethereum/token/data/TokenDataSource";
import { tokenTypes } from "@/modules/ethereum/token/di/tokenTypes";
import type {
  TypedDataDescriptorDataSource,
  TypedDataDescriptorField,
} from "@/modules/ethereum/typed-data/data/TypedDataDescriptorDataSource";
import { typedDataTypes } from "@/modules/ethereum/typed-data/di/typedDataTypes";
import type { TypedDataDescriptorContextLoader } from "@/modules/ethereum/typed-data/domain/TypedDataDescriptorContextLoader";
import { resolveTypedDataPath } from "@/modules/ethereum/typed-data/utils/resolveTypedDataPath";

@injectable()
export class DefaultTypedDataDescriptorContextLoader
  implements TypedDataDescriptorContextLoader
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(typedDataTypes.TypedDataDescriptorDataSource)
    private dataSource: TypedDataDescriptorDataSource,
    @inject(tokenTypes.TokenDataSource)
    private tokenDataSource: TokenDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("DefaultTypedDataDescriptorContextLoader");
  }

  async load(
    typedData: TypedDataDescriptorContext,
  ): Promise<TypedDataDescriptorClearSignContext> {
    const data = await this.dataSource.getTypedDataDescriptors({
      address: typedData.verifyingContract,
      chainId: typedData.chainId,
      schema: typedData.schema,
      primaryType: typedData.primaryType,
    });

    if (data.isLeft()) {
      const result: TypedDataDescriptorClearSignContext = {
        type: "error",
        error: data.extract(),
      };
      this.logger.debug("load result", { data: { result } });
      return result;
    }

    const { messageInfo, fields } = data.unsafeCoerce();
    const result: TypedDataDescriptorClearSignContext = {
      type: "success",
      messageInfo,
      fields: fields.map((field) => field.payload),
      tokens: await this.loadTokens(fields, typedData),
    };

    this.logger.debug("load result", { data: { result } });
    return result;
  }

  private async loadTokens(
    fields: TypedDataDescriptorField[],
    typedData: TypedDataDescriptorContext,
  ): Promise<string[]> {
    const addresses = new Set(
      fields
        .flatMap((field) =>
          field.tokenPath === undefined
            ? []
            : resolveTypedDataPath(
                typedData.schema,
                typedData.primaryType,
                typedData.message,
                field.tokenPath,
              ),
        )
        .filter((value): value is string => typeof value === "string")
        .map((address) => address.toLowerCase()),
    );

    const tokens: string[] = [];
    for (const address of addresses) {
      const payload = await this.tokenDataSource.getTokenInfosPayload({
        address,
        chainId: typedData.chainId,
      });
      payload.ifRight((p) => tokens.push(p));
    }
    return tokens;
  }
}
