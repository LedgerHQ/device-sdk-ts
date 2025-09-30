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
import { HexStringUtils } from "@/shared/utils/HexStringUtils";

export type DynamicNetworkContextInput = {
  chainId: number;
  deviceModelId: DeviceModelId;
};

const NETWORK_SIGNATURE_TAG = "15";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.DYNAMIC_NETWORK,
  ClearSignContextType.DYNAMIC_NETWORK_ICON,
];

@injectable()
export class DynamicNetworkContextLoader
  implements ContextLoader<DynamicNetworkContextInput>
{
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

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is DynamicNetworkContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      input.deviceModelId !== DeviceModelId.NANO_S &&
      typeof input.chainId === "number" &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: DynamicNetworkContextInput): Promise<ClearSignContext[]> {
    const { chainId, deviceModelId } = input;

    const result =
      await this._networkDataSource.getDynamicNetworkConfiguration(chainId);

    // Fetch certificate for the network configuration upfront
    const certificate = await this._certificateLoader.loadCertificate({
      keyId: KeyId.CalNetwork,
      keyUsage: KeyUsage.Network,
      targetDevice: deviceModelId,
    });

    return result.caseOf({
      Left: () => [],
      Right: (configuration) => {
        const contexts: ClearSignContext[] = [];
        const descriptor = configuration.descriptors[deviceModelId];

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
