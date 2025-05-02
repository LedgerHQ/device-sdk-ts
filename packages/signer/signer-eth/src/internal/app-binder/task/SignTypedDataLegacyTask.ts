import type {
  CommandResult,
  InternalApi,
} from "@ledgerhq/device-management-kit";
import type { TypedDataField } from "ethers";
import { TypedDataEncoder } from "ethers";
import { Just } from "purify-ts";

import type { Signature } from "@api/model/Signature";
import type { TypedData } from "@api/model/TypedData";
import { SignEIP712Command } from "@internal/app-binder/command/SignEIP712Command";
import type { EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export class SignTypedDataLegacyTask {
  constructor(
    private readonly api: InternalApi,
    private readonly data: TypedData,
    private readonly derivationPath: string,
  ) {}

  async run(): Promise<CommandResult<Signature, EthErrorCodes>> {
    // Compute domain hash and message hash on client side
    const domainHash = TypedDataEncoder.hashDomain(this.data.domain);

    if (!this.data.types[this.data.primaryType]) {
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
