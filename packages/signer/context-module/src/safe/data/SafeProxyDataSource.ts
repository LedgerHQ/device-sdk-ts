import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { ProxyResolver } from "@/proxy/model/ProxyResolver";

@injectable()
export class SafeProxyDataSource extends HttpProxyDataSource {
  constructor(
    @inject(configTypes.Config)
    config: ContextModuleConfig,
  ) {
    super(config, ProxyResolver.SAFE_GATEWAY);
  }
}
