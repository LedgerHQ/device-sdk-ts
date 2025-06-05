import { base64StringToBuffer } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import {
  SolanaSPLOwnerInfo,
  type SolanaTransactionContext,
  type SolanaTransactionContextResult,
} from "@/solana/domain/solanaContextTypes";
import PACKAGE from "@root/package.json";

import { SolanaDataSource } from "./SolanaDataSource";

@injectable()
export class HttpSolanaDataSource implements SolanaDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
  ) {
    if (!this.config.originToken) {
      throw new Error(
        "[ContextModule] - HttpSolanaDataSource: origin token is required",
      );
    }
  }

  async getSolanaContext(
    context: SolanaTransactionContext,
  ): Promise<Either<Error, SolanaTransactionContextResult>> {
    const { deviceModelId, tokenAddress, challenge, createATA } = context;

    let responseData: SolanaSPLOwnerInfo;

    try {
      if (tokenAddress) {
        // fetch address
        responseData = await axios
          .request<SolanaSPLOwnerInfo>({
            method: "GET",
            url: `${this.config.web3checks.url}/solana/owner/${tokenAddress}?challenge=${challenge}`,
            headers: {
              [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
              "X-Ledger-Client-Origin": this.config.originToken,
            },
          })
          .then((res) => res.data);
      } else if (createATA) {
        if (!createATA.address || !createATA.mintAddress) {
          return Left(
            new Error(
              "[ContextModule] - HttpSolanaDataSource: missing address or mintAddress for ATA computation",
            ),
          );
        }
        // compute address
        responseData = await axios
          .request<SolanaSPLOwnerInfo>({
            method: "GET",
            url: `${this.config.web3checks.url}/solana/computed-token-account/${createATA.address}/${createATA.mintAddress}?challenge=${challenge}`,
            headers: {
              [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
              "X-Ledger-Client-Origin": this.config.originToken,
            },
          })
          .then((res) => res.data);
      } else {
        return Left(
          new Error(
            "[ContextModule] - HttpSolanaDataSource: either tokenAddress or createATA must be provided",
          ),
        );
      }
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: Failed to fetch Solana address metadata",
        ),
      );
    }

    // parse signedDescriptor (Base64) into Uint8Array
    const descriptor = base64StringToBuffer(responseData.signedDescriptor);
    if (!descriptor) {
      return Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: invalid base64 descriptor received",
        ),
      );
    }

    // fetch CAL certificate for ProvideTrustedNamePKICommand
    try {
      const certificate = await this._certificateLoader.loadCertificate({
        keyId: "domain_metadata_key",
        keyUsage: KeyUsage.TxSimulationSigner,
        targetDevice: deviceModelId,
      });

      if (!certificate) {
        return Left(
          new Error(
            "[ContextModule] - HttpSolanaDataSource: CAL certificate is undefined",
          ),
        );
      }

      return Right({
        descriptor,
        certificate,
        tokenAccount: responseData.tokenAccount,
        owner: responseData.owner,
        contract: responseData.contract,
      });
    } catch {
      return Left(
        new Error(
          "[ContextModule] - HttpSolanaDataSource: failed to load CAL certificate",
        ),
      );
    }
  }
}
