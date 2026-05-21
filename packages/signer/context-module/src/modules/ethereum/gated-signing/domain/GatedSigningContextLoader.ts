import {
  DeviceModelId,
  HexaString,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type GatedDescriptorDataSource } from "@/modules/ethereum/gated-signing/data/GatedDescriptorDataSource";
import { gatedSigningTypes } from "@/modules/ethereum/gated-signing/di/gatedSigningTypes";
import type { ProxyDataSource } from "@/modules/ethereum/proxy/data/ProxyDataSource";
import { proxyTypes } from "@/modules/ethereum/proxy/di/proxyTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type GatedSigningContextInput = {
  to: HexaString;
  selector: HexaString;
  chainId: number;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_GATED_SIGNING,
];

function normalizeAddress(address: string): HexaString {
  const lower = address.toLowerCase();
  return (lower.startsWith("0x") ? lower : `0x${lower}`) as HexaString;
}

@injectable()
export class GatedSigningContextLoader
  implements ContextLoader<GatedSigningContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(gatedSigningTypes.GatedDescriptorDataSource)
    private readonly _dataSource: GatedDescriptorDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(proxyTypes.ProxyDataSource)
    private readonly _proxyDataSource: ProxyDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("GatedSigningContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is GatedSigningContextInput {
    return (
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      typeof input === "object" &&
      input !== null &&
      "to" in input &&
      isHexaString(input.to) &&
      input.to !== "0x" &&
      "selector" in input &&
      isHexaString(input.selector) &&
      "chainId" in input &&
      typeof input.chainId === "number" &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined
    );
  }

  async load({
    to,
    selector,
    chainId,
    deviceModelId,
  }: GatedSigningContextInput): Promise<ClearSignContext[]> {
    const directResult = await this._dataSource.getGatedDescriptor({
      contractAddress: to,
      selector,
      chainId,
    });

    if (directResult.isRight()) {
      const { signedDescriptor } = directResult.unsafeCoerce();
      const certificate = await this._loadGatedCertificate(deviceModelId);
      this.logger.debug("load result", {
        data: {
          path: "direct",
          to,
          selector,
          chainId,
          contextTypes: [ClearSignContextType.ETHEREUM_GATED_SIGNING],
        },
      });
      return [
        {
          type: ClearSignContextType.ETHEREUM_GATED_SIGNING,
          payload: signedDescriptor,
          certificate,
        },
      ];
    }

    const directError = directResult.extract() as Error;
    const errorContext: ClearSignContext = {
      type: ClearSignContextType.ERROR,
      error: directError,
    };

    const proxyResult =
      await this._proxyDataSource.getProxyImplementationAddress({
        proxyAddress: to,
        chainId,
        challenge: "",
        calldata: "0x",
      });

    if (proxyResult.isLeft()) {
      const proxyError = proxyResult.extract() as Error;
      this.logger.warn(
        "No gated descriptor found and proxy resolution failed",
        {
          data: {
            to,
            selector,
            chainId,
            directError: directError.message,
            proxyError: proxyError.message,
          },
        },
      );
      return [errorContext];
    }

    const proxyData = proxyResult.unsafeCoerce();
    const implementationAddress = normalizeAddress(
      proxyData.implementationAddress,
    );

    const implGatedResult = await this._dataSource.getGatedDescriptor({
      contractAddress: implementationAddress,
      selector,
      chainId,
    });

    if (implGatedResult.isLeft()) {
      const implError = implGatedResult.extract() as Error;
      this.logger.warn(
        "No gated descriptor found for proxy implementation address",
        {
          data: {
            to,
            implementationAddress,
            selector,
            chainId,
            directError: directError.message,
            implError: implError.message,
          },
        },
      );
      return [errorContext];
    }

    const { signedDescriptor } = implGatedResult.unsafeCoerce();
    const [proxyCertificate, gatedCertificate] = await Promise.all([
      this._certificateLoader.loadCertificate({
        keyId: proxyData.keyId,
        keyUsage: proxyData.keyUsage,
        targetDevice: deviceModelId,
      }),
      this._loadGatedCertificate(deviceModelId),
    ]);

    this.logger.debug("load result", {
      data: {
        path: "proxy",
        to,
        implementationAddress,
        selector,
        chainId,
        contextTypes: [
          ClearSignContextType.ETHEREUM_PROXY_INFO,
          ClearSignContextType.ETHEREUM_GATED_SIGNING,
        ],
      },
    });
    return [
      {
        type: ClearSignContextType.ETHEREUM_PROXY_INFO,
        payload: proxyData.signedDescriptor,
        certificate: proxyCertificate,
      },
      {
        type: ClearSignContextType.ETHEREUM_GATED_SIGNING,
        payload: signedDescriptor,
        certificate: gatedCertificate,
      },
    ];
  }

  private _loadGatedCertificate(deviceModelId: DeviceModelId) {
    return this._certificateLoader.loadCertificate({
      keyId: KeyId.CalGatedSigning,
      keyUsage: KeyUsage.GatedSigning,
      targetDevice: deviceModelId,
    });
  }
}
