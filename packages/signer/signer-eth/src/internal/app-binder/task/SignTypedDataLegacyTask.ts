import type {
  CommandResult,
  InternalApi,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import type { TypedDataField } from "ethers";
import { TypedDataEncoder } from "ethers";
import { Just } from "purify-ts";

import type { Signature } from "@api/model/Signature";
import type { TypedData } from "@api/model/TypedData";
import { SignEIP712Command } from "@internal/app-binder/command/SignEIP712Command";
import type { EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export class SignTypedDataLegacyTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly api: InternalApi,
    private readonly data: TypedData,
    private readonly derivationPath: string,
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._logger = loggerFactory("SignTypedDataLegacyTask");
  }

  async run(): Promise<CommandResult<Signature, EthErrorCodes>> {
    this._logger.debug("[run] Starting SignTypedDataLegacyTask", {
      data: {
        derivationPath: this.derivationPath,
        primaryType: this.data.primaryType,
      },
    });

    // Compute domain hash and message hash on client side
    const domainHash = TypedDataEncoder.hashDomain(this.data.domain);

    if (!this.data.types[this.data.primaryType]) {
      this._logger.error("[run] Primary type not defined in types", {
        data: { primaryType: this.data.primaryType },
      });
      throw new Error(
        `Primary type "${this.data.primaryType}" is not defined in the types.`,
      );
    }

    const typesRecord: Record<string, TypedDataField[]> = this.data.types;
    const { EIP712Domain, ...rest } = typesRecord;
    const messageHash = TypedDataEncoder.hashStruct(
      this.data.primaryType,
      rest,
      this.data.message,
    );

    this._logger.debug("[run] Computed hashes, sending blind sign command");

    // Blind sign the hash
    return await this.api.sendCommand(
      new SignEIP712Command({
        derivationPath: this.derivationPath,
        legacyArgs: Just({
          domainHash,
          messageHash,
        }),
      }),
    );
  }
}
