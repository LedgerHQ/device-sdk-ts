import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { type DynamicNetworkDataSource } from "@/dynamic-network/data/DynamicNetworkDataSource";
import { dynamicNetworkTypes } from "@/dynamic-network/di/dynamicNetworkTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

const NETWORK_SIGNATURE_TAG = "15";

@injectable()
export class DynamicNetworkContextLoader implements ContextLoader {
  private readonly _networkDataSource: DynamicNetworkDataSource;
  private readonly _config: ContextModuleConfig;
  private readonly _certificateLoader: PkiCertificateLoader;

  constructor(
    @inject(dynamicNetworkTypes.DynamicNetworkDataSource)
    networkDataSource: DynamicNetworkDataSource,
    @inject(configTypes.Config)
    config: ContextModuleConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    certificateLoader: PkiCertificateLoader,
  ) {
    this._networkDataSource = networkDataSource;
    this._config = config;
    this._certificateLoader = certificateLoader;
  }

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    if (ctx.deviceModelId === DeviceModelId.NANO_S) return [];

    const result = await this._networkDataSource.getDynamicNetworkConfiguration(
      ctx.chainId,
    );

    // Fetch certificate for the network configuration upfront
    const certificate = await this._certificateLoader.loadCertificate({
      keyId: KeyId.CalNetwork,
      keyUsage: KeyUsage.Network,
      targetDevice: ctx.deviceModelId,
    });

    return result.caseOf({
      Left: () => [],
      Right: (configuration) => {
        const contexts: ClearSignContext[] = [];
        const descriptor = configuration.descriptors[ctx.deviceModelId];

        if (!descriptor) {
          return [];
        }

        const signature = descriptor.signatures[this._config.cal.mode];

        if (!signature) {
          return [];
        }

        const configPayload = HexStringUtils.appendSignatureToPayload(
          descriptor.data,
          signature,
          NETWORK_SIGNATURE_TAG,
        );

        contexts.push({
          type: ClearSignContextType.DYNAMIC_NETWORK,
          payload: configPayload,
          certificate,
        });

        // Add icon if available in the descriptor
        if (descriptor.icon) {
          // Icons don't need signatures appended
          contexts.push({
            type: ClearSignContextType.DYNAMIC_NETWORK_ICON,
            payload: descriptor.icon,
          });
        }

        return contexts;
      },
    });
  }
}
