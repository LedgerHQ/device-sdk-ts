import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import {
  GetTransactionDescriptorsResponse,
  type LifiDataSource,
} from "@/modules/solana/lifi/data/LifiDataSource";
import { lifiTypes } from "@/modules/solana/lifi/di/lifiTypes";
import {
  type SolanaContextError,
  type SolanaLifiContextSuccess,
  type SolanaTransactionDescriptorList,
} from "@/modules/solana/model/SolanaContextTypes";
import {
  type SolanaLifiInstructionMeta,
  type SolanaLifiPayload,
} from "@/modules/solana/model/SolanaPayloads";
import { type SolanaTransactionContext } from "@/modules/solana/model/SolanaTransactionContext";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_LIFI,
];

@injectable()
export class LifiContextLoader
  implements ContextLoader<SolanaTransactionContext>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(lifiTypes.LifiDataSource)
    private readonly dataSource: LifiDataSource,
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("LifiContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaTransactionContext {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) {
      this.logger.debug("[canHandle] Skipping, expected type does not match", {
        data: { expectedTypes, required: ClearSignContextType.SOLANA_LIFI },
      });
      return false;
    }

    if (typeof input === "object" && input !== null && "templateId" in input) {
      const templateId = (input as { templateId: unknown }).templateId;
      const isValid = typeof templateId === "string" && templateId.length > 0;
      this.logger.debug("[canHandle] Field validation result", {
        data: { templateId, isValid },
      });
      return isValid;
    }

    this.logger.debug("[canHandle] Field does not contain a valid templateId", {
      data: { input },
    });
    return false;
  }

  public async load(
    solanaLifiContextInput: SolanaTransactionContext,
  ): Promise<ClearSignContext[]> {
    this.logger.debug("[load] Loading solana Lifi context", {
      data: { input: solanaLifiContextInput },
    });
    const result = await this._loadInternal(solanaLifiContextInput);
    if (result.type === ClearSignContextType.ERROR) {
      return [{ type: ClearSignContextType.ERROR, error: result.error }];
    }
    const r = result as SolanaLifiContextSuccess;
    return [
      {
        type: ClearSignContextType.SOLANA_LIFI,
        payload: r.payload,
        certificate: r.certificate,
      },
    ];
  }

  private async _loadInternal(
    solanaLifiContextInput: SolanaTransactionContext,
  ): Promise<SolanaLifiContextSuccess | SolanaContextError> {
    this.logger.debug("[_loadInternal] Loading solana Lifi context", {
      data: { input: solanaLifiContextInput },
    });
    const { templateId, deviceModelId } = solanaLifiContextInput;

    if (!templateId) {
      return {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] LifiContextLoader: templateId is missing",
        ),
      };
    }

    const payload = await this.dataSource.getTransactionDescriptorsPayload({
      templateId,
    });

    const certificate: PkiCertificate | undefined =
      await this._certificateLoader.loadCertificate({
        keyId: KeyId.SwapTemplateKey,
        keyUsage: KeyUsage.SwapTemplate,
        targetDevice: deviceModelId,
      });

    return payload.caseOf({
      Left: (error): SolanaLifiContextSuccess | SolanaContextError => {
        this.logger.error("[_loadInternal] Error loading solana Lifi context", {
          data: { error },
        });

        return {
          type: ClearSignContextType.ERROR,
          error,
        };
      },
      Right: (value): SolanaLifiContextSuccess | SolanaContextError => {
        const lifiPayload = this.buildPayload(value);
        this.logger.debug(
          "[_loadInternal] Successfully loaded solana Lifi context",
          {
            data: {
              descriptors: lifiPayload.descriptors,
              instructionsCount: lifiPayload.instructions.length,
              certificate,
            },
          },
        );

        return {
          type: ClearSignContextType.SOLANA_LIFI,
          payload: lifiPayload,
          certificate,
        };
      },
    });
  }

  private buildPayload(
    response: GetTransactionDescriptorsResponse,
  ): SolanaLifiPayload {
    return {
      descriptors: this.pluckTransactionData(response),
      instructions: this.extractInstructionsMeta(response),
    };
  }

  private pluckTransactionData(
    tokenData: GetTransactionDescriptorsResponse,
  ): SolanaTransactionDescriptorList {
    const signatureKind = this.config.cal.mode || "prod";
    const output: SolanaTransactionDescriptorList = {};
    const descriptors = tokenData.descriptors ?? [];

    this.logger.debug("[pluckTransactionData] Processing descriptors", {
      data: { descriptorsCount: descriptors.length, signatureKind },
    });

    for (const item of descriptors) {
      const key = `${item.program_id}:${item.discriminator_hex ?? ""}`;
      const descriptor = {
        data: item.descriptor.data,
        descriptorType: item.descriptor.descriptorType,
        descriptorVersion: item.descriptor.descriptorVersion,
        signature: item.descriptor.signatures[signatureKind] ?? "",
        ...(item.has_basis_point !== undefined && {
          has_basis_point: item.has_basis_point,
        }),
      };
      (output[key] ??= []).push(descriptor);
      this.logger.debug("[pluckTransactionData] Mapped program descriptor", {
        data: {
          programId: item.program_id,
          discriminatorHex: item.discriminator_hex ?? "",
          key,
        },
      });
    }

    this.logger.debug("[pluckTransactionData] Completed processing", {
      data: { outputKeys: Object.keys(output) },
    });

    return output;
  }

  private extractInstructionsMeta(
    response: GetTransactionDescriptorsResponse,
  ): SolanaLifiInstructionMeta[] {
    const instructions = response.instructions ?? [];

    this.logger.debug(
      "[extractInstructionsMeta] Extracting instructions metadata",
      {
        data: { instructionsCount: instructions.length },
      },
    );

    const meta = instructions.map((ix) => ({
      program_id: ix.program_id,
      ...(ix.discriminator_hex !== undefined && {
        discriminator_hex: ix.discriminator_hex,
      }),
      ...(ix.amount !== undefined && {
        has_basis_point: ix.amount.capped_bps !== undefined,
      }),
    }));

    this.logger.debug(
      "[extractInstructionsMeta] Completed extracting instructions metadata",
      {
        data: {
          meta: meta.map((m) => ({
            programId: m.program_id,
            discriminatorHex: m.discriminator_hex,
          })),
        },
      },
    );

    return meta;
  }
}
