import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { array, Codec, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import {
  type SolanaGatedDescriptor,
  type SolanaGatedDescriptorDataSource,
} from "@/modules/multichain/gated-signing/data/SolanaGatedDescriptorDataSource";
import { gatedSigningTypes } from "@/modules/multichain/gated-signing/di/gatedSigningTypes";
import {
  findSolanaGatedDescriptor,
  type SolanaGatedSigningInstruction,
} from "@/modules/multichain/gated-signing/utils/matchSolanaGatedDescriptor";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";
import { uint8ArrayCodec } from "@/shared/utils/uint8ArrayCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_GATED_SIGNING,
];

export type SolanaGatedSigningContextInput = {
  deviceModelId: DeviceModelId;
  gatedSigning: {
    /**
     * Top-level instructions of the message, in order. The program ID must
     * come from the static account keys, as the device only reads it there.
     */
    instructions: SolanaGatedSigningInstruction[];
  };
};

const solanaGatedSigningInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  gatedSigning: Codec.interface({
    instructions: array(
      Codec.interface({ programId: string, data: uint8ArrayCodec }),
    ),
  }),
});

/**
 * Finds the gated descriptor that applies to a transaction.
 *
 * Fetches the gated descriptors of every program the message calls, then
 * applies the same rule as the device (see `findSolanaGatedDescriptor`). Emits one
 * SOLANA_GATED_SIGNING context when an instruction matches, nothing when
 * none does, and an ERROR context when nothing matched and a lookup failed.
 */
@injectable()
export class SolanaGatedSigningContextLoader
  implements ContextLoader<SolanaGatedSigningContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(gatedSigningTypes.SolanaGatedDescriptorDataSource)
    private readonly dataSource: SolanaGatedDescriptorDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaGatedSigningContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaGatedSigningContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) return false;
    return solanaGatedSigningInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ gatedSigning }) => gatedSigning.instructions.length > 0,
    });
  }

  public async load({
    deviceModelId,
    gatedSigning: { instructions },
  }: SolanaGatedSigningContextInput): Promise<ClearSignContext[]> {
    const programIds = Array.from(
      new Set(instructions.map(({ programId }) => programId)),
    );

    const descriptors: SolanaGatedDescriptor[] = [];
    const failures: Error[] = [];
    const results = await Promise.all(
      programIds.map((programId) =>
        this.dataSource.getGatedDescriptors({ programId }),
      ),
    );
    for (const result of results) {
      result.caseOf({
        Left: (error) => failures.push(error),
        Right: (found) => descriptors.push(...found),
      });
    }

    const match = findSolanaGatedDescriptor(instructions, descriptors);
    if (match === null) {
      const [failure] = failures;
      this.logger.debug("[load] No gated descriptor matches", {
        data: { programIds, failures: failures.map((e) => e.message) },
      });
      return failure === undefined
        ? []
        : [{ type: ClearSignContextType.ERROR, error: failure }];
    }

    const certificate = await this.certificateLoader.loadCertificate({
      keyId: KeyId.CalGatedSigning,
      keyUsage: KeyUsage.GatedSigning,
      targetDevice: deviceModelId,
    });

    this.logger.debug("[load] Gated descriptor matches", {
      data: {
        programId: match.descriptor.programId,
        instructionIndex: match.instructionIndex,
        programOnly: match.descriptor.discriminator.length === 0,
      },
    });
    return [
      {
        type: ClearSignContextType.SOLANA_GATED_SIGNING,
        payload: match.descriptor.signedDescriptor,
        certificate,
      },
    ];
  }
}
