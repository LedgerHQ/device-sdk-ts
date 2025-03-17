import {
  type ClearSignContextSuccess,
  type ClearSignContextType,
  type ContextModule,
  type TypedDataClearSignContextSuccess,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { TypedDataEncoder, type TypedDataField } from "ethers";
import { Just, type Maybe, Nothing } from "purify-ts";

import { type TypedData } from "@api/model/TypedData";
import {
  GetWeb3CheckTask,
  type GetWeb3CheckTaskArgs,
} from "@internal/app-binder/task/GetWeb3CheckTask";
import { type ProvideEIP712ContextTaskArgs } from "@internal/app-binder/task/ProvideEIP712ContextTask";
import { ApplicationChecker } from "@internal/shared/utils/ApplicationChecker";
import { TypedDataValueField } from "@internal/typed-data/model/Types";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class BuildEIP712ContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly contextModule: ContextModule,
    private readonly parser: TypedDataParserService,
    private readonly data: TypedData,
    private readonly derivationPath: string,
    private readonly web3ChecksEnabled: boolean,
    private readonly getWeb3ChecksFactory = (
      api: InternalApi,
      args: GetWeb3CheckTaskArgs,
    ) => new GetWeb3CheckTask(api, args),
  ) {}

  async run(): Promise<ProvideEIP712ContextTaskArgs> {
    // Run the web3checks if needed
    let web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null =
      null;
    if (this.web3ChecksEnabled) {
      web3Check = (
        await this.getWeb3ChecksFactory(this.api, {
          contextModule: this.contextModule,
          derivationPath: this.derivationPath,
          data: this.data,
        }).run()
      ).web3Check;
    }

    // Legacy blind signing context
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

    // Clear signing context
    // Parse the message types and values
    const parsed = this.parser.parse(this.data);
    if (parsed.isLeft()) {
      throw parsed.extract();
    }
    const { types, domain, message } = parsed.unsafeCoerce();

    // Get clear signing context, if any
    let clearSignContext: Maybe<TypedDataClearSignContextSuccess> = Nothing;
    const version = this.getClearSignVersion();
    if (version.isJust()) {
      const verifyingContract =
        this.data.domain.verifyingContract?.toLowerCase() || ZERO_ADDRESS;
      const chainId = this.data.domain.chainId || 0;
      const fieldsValues = message
        .filter((v) => v.value instanceof TypedDataValueField)
        .map((v) => ({
          path: v.path,
          value: (v.value as TypedDataValueField).data,
        }));
      const filters = await this.contextModule.getTypedDataFilters({
        verifyingContract,
        chainId,
        version: version.extract(),
        schema: this.data.types,
        fieldsValues,
      });
      if (filters.type === "success") {
        clearSignContext = Just(filters);
      }
    }

    // Return the args for provide context task
    const provideTaskArgs: ProvideEIP712ContextTaskArgs = {
      web3Check,
      types,
      domain,
      message,
      clearSignContext,
      domainHash,
      messageHash,
    };
    return provideTaskArgs;
  }

  private getClearSignVersion(): Maybe<"v1" | "v2"> {
    const deviceState = this.api.getDeviceSessionState();
    if (
      !new ApplicationChecker(deviceState)
        .withMinVersionInclusive("1.10.0")
        .excludeDeviceModel(DeviceModelId.NANO_S)
        .check()
    ) {
      return Nothing;
    }

    // EIP712 v2 (amount & datetime filters) supported since 1.11.0:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#1110-1
    // But some issues were still present until 1.12.0 among which:
    // * V2 descriptor with missing token not supported by the app
    // * Empty arrays with filters not correctly handled
    // * Trusted name filters not yet released
    // Therefore it's safer and easier to use V1 filters before 1.12.0:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#1120
    const shouldUseV2Filters = new ApplicationChecker(deviceState)
      .withMinVersionInclusive("1.12.0")
      .check();
    return shouldUseV2Filters ? Just("v2") : Just("v1");
  }
}
