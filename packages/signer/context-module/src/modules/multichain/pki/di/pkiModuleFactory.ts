import { ContainerModule } from "inversify";

import { HttpPkiCertificateDataSource } from "@/modules/multichain/pki/data/HttpPkiCertificateDataSource";
import { DefaultPkiCertificateLoader } from "@/modules/multichain/pki/domain/DefaultPkiCertificateLoader";

import { pkiTypes } from "./pkiTypes";

export const nanoPkiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(pkiTypes.PkiCertificateDataSource).to(HttpPkiCertificateDataSource);
    bind(pkiTypes.PkiCertificateLoader).to(DefaultPkiCertificateLoader);
  });
