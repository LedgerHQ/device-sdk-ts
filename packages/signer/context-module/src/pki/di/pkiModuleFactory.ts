import { ContainerModule } from "inversify";

import { HttpPkiCertificateDataSource } from "@/pki/data/HttpPkiCertificateDataSource";
import { DefaultPkiCertificateLoader } from "@/pki/domain/DefaultPkiCertificateLoader";

import { pkiTypes } from "./pkiTypes";

export const nanoPkiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(pkiTypes.PkiCertificateDataSource).to(HttpPkiCertificateDataSource);
    bind(pkiTypes.PkiCertificateLoader).to(DefaultPkiCertificateLoader);
  });
