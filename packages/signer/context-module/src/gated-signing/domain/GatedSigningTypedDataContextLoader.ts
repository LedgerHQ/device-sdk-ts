import {
  DeviceModelId,
  type HexaString,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type GatedDescriptorDataSource } from "@/gated-signing/data/GatedDescriptorDataSource";
import { gatedSigningTypes } from "@/gated-signing/di/gatedSigningTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import type { TypedDataSchema } from "@/shared/model/TypedDataContext";
import { getSchemaHash } from "@/typed-data/utils/getSchemaHash";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type GatedSigningTypedDataContextInput = {
  data: {
    types: TypedDataSchema;
    domain?: { verifyingContract?: string };
  };
  chainId: number;
  deviceModelId: DeviceModelId;
  challenge: string;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.GATED_SIGNING,
];

function hasTypedDataShape(
  data: unknown,
): data is { types: TypedDataSchema; domain?: { verifyingContract?: string } } {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (
    !obj["types"] ||
    typeof obj["types"] !== "object" ||
    Array.isArray(obj["types"])
  ) {
    return false;
  }
  const types = obj["types"] as Record<string, unknown>;
  for (const key of Object.keys(types)) {
    if (typeof key !== "string") return false;
    const value = types[key];
    if (!Array.isArray(value)) return false;
    for (const item of value) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as { name?: unknown }).name !== "string" ||
        typeof (item as { type?: unknown }).type !== "string"
      ) {
        return false;
      }
    }
  }
  return true;
}

@injectable()
export class GatedSigningTypedDataContextLoader
  implements ContextLoader<GatedSigningTypedDataContextInput>
{
  constructor(
    @inject(gatedSigningTypes.GatedDescriptorDataSource)
    private readonly _dataSource: GatedDescriptorDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(proxyTypes.ProxyDataSource)
    private readonly _proxyDataSource: ProxyDataSource,
  ) {}

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is GatedSigningTypedDataContextInput {
    return (
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      typeof input === "object" &&
      input !== null &&
      "data" in input &&
      hasTypedDataShape((input as GatedSigningTypedDataContextInput).data) &&
      "chainId" in input &&
      "deviceModelId" in input &&
      (input as GatedSigningTypedDataContextInput).deviceModelId !==
        undefined &&
      "challenge" in input &&
      typeof (input as GatedSigningTypedDataContextInput).challenge === "string"
    );
  }

  async load({
    data,
    chainId,
    deviceModelId,
    challenge,
  }: GatedSigningTypedDataContextInput): Promise<ClearSignContext[]> {
    const raw = data.domain?.verifyingContract?.toLowerCase() ?? ZERO_ADDRESS;
    const verifyingContract: HexaString = raw.startsWith("0x")
      ? (raw as HexaString)
      : (`0x${raw}` as HexaString);
    const schemaHash = getSchemaHash(data.types);

    const directResult = await this._dataSource.getGatedDescriptorForTypedData({
      contractAddress: verifyingContract,
      schemaHash,
      chainId,
    });

    if (directResult.isRight()) {
      const { signedDescriptor } = directResult.unsafeCoerce();
      const certificate = await this._certificateLoader.loadCertificate({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: deviceModelId,
      });
      return [
        {
          type: ClearSignContextType.GATED_SIGNING,
          payload: signedDescriptor,
          certificate,
        },
      ];
    }

    const firstError: Error = directResult.caseOf({
      Left: (error) => error,
      Right: () => new Error("unreachable"),
    });

    const proxyResult =
      await this._proxyDataSource.getProxyImplementationAddress({
        proxyAddress: verifyingContract,
        chainId,
        challenge,
        calldata: "0x",
      });

    if (proxyResult.isLeft()) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: firstError,
        },
      ];
    }

    const proxyData = proxyResult.unsafeCoerce();
    const implRaw = proxyData.implementationAddress.toLowerCase();
    const implementationAddress: HexaString = implRaw.startsWith("0x")
      ? (implRaw as HexaString)
      : (`0x${implRaw}` as HexaString);

    const implGatedResult =
      await this._dataSource.getGatedDescriptorForTypedData({
        contractAddress: implementationAddress,
        schemaHash,
        chainId,
      });

    if (implGatedResult.isLeft()) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: firstError,
        },
      ];
    }

    const { signedDescriptor } = implGatedResult.unsafeCoerce();
    const [proxyCertificate, gatedCertificate] = await Promise.all([
      this._certificateLoader.loadCertificate({
        keyId: proxyData.keyId,
        keyUsage: proxyData.keyUsage,
        targetDevice: deviceModelId,
      }),
      this._certificateLoader.loadCertificate({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: deviceModelId,
      }),
    ]);

    return [
      {
        type: ClearSignContextType.PROXY_INFO,
        payload: proxyData.signedDescriptor,
        certificate: proxyCertificate,
      },
      {
        type: ClearSignContextType.GATED_SIGNING,
        payload: signedDescriptor,
        certificate: gatedCertificate,
      },
    ];
  }
}
