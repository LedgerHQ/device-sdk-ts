import {
  DeviceModelId,
  HexaString,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { MaybeAsync } from "purify-ts";

import type { CalldataDescriptorDataSource } from "@/calldata/data/CalldataDescriptorDataSource";
import { calldataTypes } from "@/calldata/di/calldataTypes";
import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type CalldataContextInput = {
  to: HexaString;
  data: HexaString;
  selector: HexaString;
  chainId: number;
  deviceModelId: DeviceModelId;
};

type GetContextsParams = {
  address: string;
  chainId: number;
  data: string;
  selector: HexaString;
  deviceModelId: DeviceModelId;
};

@injectable()
export class CalldataContextLoader
  implements ContextLoader<CalldataContextInput>
{
  constructor(
    @inject(calldataTypes.DappCalldataDescriptorDataSource)
    private dappDataSource: CalldataDescriptorDataSource,
    @inject(calldataTypes.TokenCalldataDescriptorDataSource)
    private tokenDataSource: CalldataDescriptorDataSource,
    @inject(proxyTypes.ProxyDataSource)
    private proxyDataSource: ProxyDataSource,
  ) {}

  canHandle(input: unknown): input is CalldataContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "to" in input &&
      "data" in input &&
      "selector" in input &&
      "chainId" in input &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      input.deviceModelId !== DeviceModelId.NANO_S &&
      typeof input.chainId === "number" &&
      isHexaString(input.to) &&
      input.to !== "0x" &&
      isHexaString(input.data) &&
      isHexaString(input.selector) &&
      input.selector !== "0x"
    );
  }

  async load(input: CalldataContextInput): Promise<ClearSignContext[]> {
    const { to, data, selector, chainId, deviceModelId } = input;

    const param: GetContextsParams = {
      address: to,
      chainId,
      selector,
      deviceModelId,
      data,
    };

    return this._getContexts(param, this.dappDataSource)
      .alt(this._getContexts(param, this.tokenDataSource))
      .alt(this._getContextsWithProxy(param, this.dappDataSource))
      .orDefault([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] CalldataContextLoader: No calldata contexts found",
          ),
        },
      ]);
  }

  private _getContexts(
    { address, chainId, selector, deviceModelId }: GetContextsParams,
    datasource: CalldataDescriptorDataSource,
  ): MaybeAsync<ClearSignContext[]> {
    return MaybeAsync(async ({ liftMaybe }) => {
      const result = await datasource.getCalldataDescriptors({
        deviceModelId,
        address,
        chainId,
        selector,
      });

      return liftMaybe(result.toMaybe().filter((ctxs) => ctxs.length > 0));
    });
  }

  private _getContextsWithProxy(
    { address, chainId, selector, deviceModelId, data }: GetContextsParams,
    datasource: CalldataDescriptorDataSource,
  ): MaybeAsync<ClearSignContext[]> {
    const proxyAddress = MaybeAsync(async ({ liftMaybe }) => {
      const result = await this.proxyDataSource.getProxyImplementationAddress({
        calldata: data,
        proxyAddress: address,
        chainId,
        challenge: "",
      });
      return liftMaybe(result.toMaybe());
    });

    return proxyAddress
      .map<MaybeAsync<ClearSignContext[]>>(({ implementationAddress }) => {
        const params = {
          address: implementationAddress,
          chainId,
          selector,
          deviceModelId,
          data,
        };
        return this._getContexts(params, datasource).map((contexts) => [
          // Add a proxy info context to the list of contexts
          // to specify that the proxy info should be refetched during the provide step
          {
            type: ClearSignContextType.PROXY_INFO,
            payload: "0x",
          },
          ...contexts,
        ]);
      })
      .join(); // join the two MaybeAsyncs
  }
}
