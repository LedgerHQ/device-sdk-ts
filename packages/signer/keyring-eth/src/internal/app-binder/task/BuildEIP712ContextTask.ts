import {
  type ContextModule,
  TypedDataClearSignContextSuccess,
} from "@ledgerhq/context-module";
import {
  DeviceSessionStateType,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { Just, Maybe, Nothing } from "purify-ts";
import { gte } from "semver";

import { type TypedData } from "@api/model/TypedData";
import { type ProvideEIP712ContextTaskArgs } from "@internal/app-binder/task/ProvideEIP712ContextTask";
import { TypedDataValueField } from "@internal/typed-data/model/Types";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class BuildEIP712ContextTask {
  constructor(
    private api: InternalApi,
    private contextModule: ContextModule,
    private parser: TypedDataParserService,
    private data: TypedData,
  ) {}

  async run(): Promise<ProvideEIP712ContextTaskArgs> {
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
      types,
      domain,
      message,
      clearSignContext,
    };
    return provideTaskArgs;
  }

  private getClearSignVersion(): Maybe<"v1" | "v2"> {
    const deviceState = this.api.getDeviceSessionState();
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return Nothing;
    }
    if (deviceState.currentApp.name !== "Ethereum") {
      return Nothing;
    }
    // EIP712 v2 (amount & datetime filters) supported since 1.11.0:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#1110-1
    const shouldUseV2Filters = gte(deviceState.currentApp.version, "1.11.0");
    return shouldUseV2Filters ? Just("v2") : Just("v1");
  }
}
