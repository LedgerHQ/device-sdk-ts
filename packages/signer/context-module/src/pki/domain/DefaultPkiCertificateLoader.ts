import { inject, injectable } from "inversify";

import { type PkiCertificateDataSource } from "@/pki/data/PkiCertificateDataSource";
import { pkiTypes } from "@/pki/di/pkiDiTypes";

import { PkiCertificateLoader } from "./PkiCertificateLoader";
import { PkiCertificate, PkiCertificateInfo } from "./pkiCertificateTypes";

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

    return certificate.orDefault(undefined);
  }
}
