import type { HexaString } from "@ledgerhq/device-management-kit";
import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import type {
  TypedDataCalldataIndex,
  TypedDataCalldataInfo,
  TypedDataClearSignContext,
  TypedDataFilter,
  TypedDataFilterCalldata,
  TypedDataFilterCalldataInfo,
  TypedDataFilterPath,
  TypedDataToken,
  TypedDataTokenIndex,
} from "@/shared/model/TypedDataClearSignContext";
import {
  TypedDataCalldataParamPresence,
  VERIFYING_CONTRACT_TOKEN_INDEX,
} from "@/shared/model/TypedDataClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";
import type { TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import { typedDataTypes } from "@/typed-data/di/typedDataTypes";
import type { TypedDataContextLoader } from "@/typed-data/domain/TypedDataContextLoader";

type ResolvedProxy = {
  resolvedAddress: string;
  context?: ClearSignContextSuccess<ClearSignContextType.PROXY_DELEGATE_CALL>;
};

@injectable()
export class DefaultTypedDataContextLoader implements TypedDataContextLoader {
  constructor(
    @inject(typedDataTypes.TypedDataDataSource)
    private dataSource: TypedDataDataSource,
    @inject(tokenTypes.TokenDataSource)
    private tokenDataSource: TokenDataSource,
    @inject(proxyTypes.ProxyDataSource)
    private proxyDataSource: ProxyDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
  ) {}

  async load(typedData: TypedDataContext): Promise<TypedDataClearSignContext> {
    // Get the typed data filters from the data source
    let proxy:
      | ClearSignContextSuccess<ClearSignContextType.PROXY_DELEGATE_CALL>
      | undefined = undefined;
    let data = await this.dataSource.getTypedDataFilters({
      address: typedData.verifyingContract,
      chainId: typedData.chainId,
      version: typedData.version,
      schema: typedData.schema,
    });

    // If there was an error getting the typed data filters, try to resolve a proxy at that address
    if (data.isLeft()) {
      const { resolvedAddress, context } = await this.resolveProxy(typedData);
      if (context !== undefined) {
        proxy = context;
        data = await this.dataSource.getTypedDataFilters({
          address: resolvedAddress,
          chainId: typedData.chainId,
          version: typedData.version,
          schema: typedData.schema,
        });
      }
      // If there was stil an error, return immediately
      if (data.isLeft()) {
        return {
          type: "error",
          error: data.extract(),
        };
      }
    }

    // Else, extract the message info and filters
    const { messageInfo, filters, calldatasInfos } = data.unsafeCoerce();
    const mappedFilters = filters.reduce(
      (acc, filter) => {
        acc[filter.path] = filter;
        return acc;
      },
      {} as Record<TypedDataFilterPath, TypedDataFilter>,
    );

    return {
      type: "success",
      messageInfo,
      filters: mappedFilters,
      trustedNamesAddresses: this.extractTrustedNames(filters, typedData),
      tokens: await this.extractTokens(filters, typedData),
      calldatas: this.extractCalldatas(filters, calldatasInfos, typedData),
      proxy,
    };
  }

  private async resolveProxy(
    typedData: TypedDataContext,
  ): Promise<ResolvedProxy> {
    // Try to resolve the proxy
    const proxyDelegateCall =
      await this.proxyDataSource.getProxyImplementationAddress({
        calldata: "0x",
        proxyAddress: typedData.verifyingContract,
        chainId: typedData.chainId,
        challenge: typedData.challenge ?? "",
      });

    // Early return on failure
    if (proxyDelegateCall.isLeft()) {
      return {
        resolvedAddress: typedData.verifyingContract,
        context: undefined,
      };
    }

    // Fetch descriptor on success
    const certificate = await this._certificateLoader.loadCertificate({
      keyId: KeyId.CalCalldataKey,
      keyUsage: KeyUsage.Calldata,
      targetDevice: typedData.deviceModelId,
    });
    const proxyData = proxyDelegateCall.unsafeCoerce();
    return {
      resolvedAddress: proxyData.implementationAddress,
      context: {
        type: ClearSignContextType.PROXY_DELEGATE_CALL,
        payload: proxyData.signedDescriptor,
        certificate,
      },
    };
  }

  private extractTrustedNames(
    filters: TypedDataFilter[],
    typedData: TypedDataContext,
  ): Record<TypedDataFilterPath, HexaString> {
    return filters
      .filter((filter) => filter.type === "trusted-name")
      .reduce(
        (acc, filter) => {
          const values = typedData.fieldsValues.filter(
            (entry) => entry.path === filter.path,
          );
          if (values.length !== 0) {
            const value = values[0]!;
            const address = this.convertAddressToHexaString(value.value);
            acc[filter.path] = address;
          }
          return acc;
        },
        {} as Record<TypedDataFilterPath, HexaString>,
      );
  }

  private async extractTokens(
    filters: TypedDataFilter[],
    typedData: TypedDataContext,
  ): Promise<Record<TypedDataTokenIndex, TypedDataToken>> {
    const mappedTokens: Record<TypedDataTokenIndex, TypedDataToken> = {};
    for (const filter of filters) {
      if (filter.type !== "token" && filter.type !== "amount") {
        continue; // no token reference
      }
      const tokenIndex = filter.tokenIndex;
      if (mappedTokens[tokenIndex] !== undefined) {
        continue; // Already fetched for a previous filter
      }

      // If the filter is a token, get token address from typed message values, and fetch descriptor
      if (filter.type === "token") {
        const values = typedData.fieldsValues.filter(
          (entry) => entry.path === filter.path,
        );
        if (values.length === 0) {
          // No value matching the referenced token. It may be located in an empty array.
          continue;
        }
        const value = values[0]!;
        const address = this.convertAddressToHexaString(value.value);

        // Arrays with different tokens are not supported since there is only 1 tokenIndex per filter.
        // Only fetch tokens if all values are the same.
        if (
          values.every(
            (entry) => this.convertAddressToHexaString(entry.value) === address,
          )
        ) {
          // Fetch descriptor
          const chainId = typedData.chainId;
          const payload = await this.tokenDataSource.getTokenInfosPayload({
            address,
            chainId,
          });
          payload.ifRight((p) => {
            mappedTokens[tokenIndex] = p;
          });
        }
      }

      // If the filter is an amount with a reference to the verifyingContract, fetch verifyingContract descriptor.
      // This is because descriptors data-sources should be compatible with Ledger devices specifications:
      // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#amount-join-value
      else if (
        filter.type === "amount" &&
        tokenIndex === VERIFYING_CONTRACT_TOKEN_INDEX
      ) {
        const address = typedData.verifyingContract;
        const chainId = typedData.chainId;
        const payload = await this.tokenDataSource.getTokenInfosPayload({
          address,
          chainId,
        });
        payload.ifRight((p) => {
          mappedTokens[tokenIndex] = p;
        });
      }
    }
    return mappedTokens;
  }

  private extractCalldatas(
    filters: TypedDataFilter[],
    calldatasInfos: Record<TypedDataCalldataIndex, TypedDataFilterCalldataInfo>,
    typedData: TypedDataContext,
  ): Record<TypedDataCalldataIndex, TypedDataCalldataInfo> {
    // Map filters per calldataIndex
    const calldataFilters = filters.reduce(
      (acc, filter) => {
        if (
          filter.type === "calldata-value" ||
          filter.type === "calldata-callee" ||
          filter.type === "calldata-chain-id" ||
          filter.type === "calldata-selector" ||
          filter.type === "calldata-amount" ||
          filter.type === "calldata-spender"
        ) {
          const array = acc[filter.calldataIndex];
          if (array === undefined) {
            acc[filter.calldataIndex] = [filter];
          } else {
            array.push(filter);
          }
        }
        return acc;
      },
      {} as Record<TypedDataCalldataIndex, TypedDataFilterCalldata[]>,
    );

    // Iterate over calldatas
    const mappedCalldatas: Record<
      TypedDataCalldataIndex,
      TypedDataCalldataInfo
    > = {};
    for (const calldataIndex in calldatasInfos) {
      const infos = calldatasInfos[calldataIndex]!;
      const filters = calldataFilters[calldataIndex];
      if (!filters) {
        continue;
      }

      // Get data
      const data = this.extractHexaString(
        filters.find((filter) => filter.type === "calldata-value"),
        typedData,
        "0x",
      );

      // Get selector
      const selector = this.extractHexaString(
        filters.find((filter) => filter.type === "calldata-selector"),
        typedData,
        data.slice(0, 10),
      );

      // Get to
      const to = this.extractAddress(
        filters.find((filter) => filter.type === "calldata-callee"),
        typedData,
        infos.calleeFlag,
      );

      // Get from
      const from = this.extractAddress(
        filters.find((filter) => filter.type === "calldata-spender"),
        typedData,
        infos.spenderFlag,
      );

      // Get amount
      const value = this.extractBigint(
        filters.find((filter) => filter.type === "calldata-amount"),
        typedData,
        undefined,
      );

      // Get chainId
      const chainIdBigint = this.extractBigint(
        filters.find((filter) => filter.type === "calldata-chain-id"),
        typedData,
        undefined,
      );
      const chainId =
        chainIdBigint !== undefined && chainIdBigint < Number.MAX_SAFE_INTEGER
          ? Number(chainIdBigint)
          : typedData.chainId;

      mappedCalldatas[calldataIndex] = {
        filter: infos,
        subset: {
          chainId,
          data,
          selector,
          to,
          value,
          from,
        },
      };
    }
    return mappedCalldatas;
  }

  private extractHexaString(
    filter: TypedDataFilter | undefined,
    typedData: TypedDataContext,
    defaultValue: string,
  ): string {
    if (filter !== undefined) {
      const values = typedData.fieldsValues.filter(
        (entry) => entry.path === filter.path,
      );
      if (values.length !== 0) {
        return bufferToHexaString(values[0]!.value);
      }
    }
    return defaultValue;
  }

  private extractAddress(
    filter: TypedDataFilter | undefined,
    typedData: TypedDataContext,
    presenceFlag: TypedDataCalldataParamPresence,
    defaultValue?: string,
  ): string | undefined {
    if (presenceFlag === TypedDataCalldataParamPresence.VerifyingContract) {
      return typedData.verifyingContract;
    } else if (filter !== undefined) {
      const values = typedData.fieldsValues.filter(
        (entry) => entry.path === filter.path,
      );
      if (values.length !== 0) {
        return this.convertAddressToHexaString(values[0]!.value);
      }
    }
    return defaultValue;
  }

  private extractBigint(
    filter: TypedDataFilter | undefined,
    typedData: TypedDataContext,
    defaultValue: bigint | undefined,
  ): bigint | undefined {
    if (filter !== undefined) {
      const values = typedData.fieldsValues.filter(
        (entry) => entry.path === filter.path,
      );
      if (values.length !== 0) {
        return BigInt(bufferToHexaString(values[0]!.value));
      }
    }
    return defaultValue;
  }

  private convertAddressToHexaString(address: Uint8Array): HexaString {
    // Address size is 20 bytes so 40 characters, padded with zeros on the left
    return `0x${Array.from(address, (byte) =>
      byte.toString(16).padStart(2, "0"),
    )
      .join("")
      .padStart(40, "0")}`;
  }
}
