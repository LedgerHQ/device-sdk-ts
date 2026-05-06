import { inject, injectable } from "inversify";

import { type PkiCertificateDataSource } from "@/modules/chain-agnostic/pki/data/PkiCertificateDataSource";
import { pkiTypes } from "@/modules/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificate } from "@/modules/chain-agnostic/pki/model/PkiCertificate";
import { type PkiCertificateInfo } from "@/modules/chain-agnostic/pki/model/PkiCertificateInfo";

import { PkiCertificateLoader } from "./PkiCertificateLoader";

@injectable()
export class DefaultPkiCertificateLoader implements PkiCertificateLoader {
  private _dataSource: PkiCertificateDataSource;

  constructor(
    @inject(pkiTypes.PkiCertificateDataSource)
    dataSource: PkiCertificateDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async loadCertificate(
    certificateInfos: PkiCertificateInfo,
  ): Promise<PkiCertificate | undefined> {
    const certificate =
      await this._dataSource.fetchCertificate(certificateInfos);

    // TODO add logs error with certificate.left()
    return certificate.orDefault(undefined);
  }
}
