import { ContainerModule } from "inversify";

import { HttpPkiCertificateDataSource } from "@/pki/data/HttpPkiCertificateDataSource";
import { DefaultPkiCertificateLoader } from "@/pki/domain/DefaultPkiCertificateLoader";

import { pkiTypes } from "./pkiDiTypes";

export const nanoPkiModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(pkiTypes.PkiCertificateDataSource).to(HttpPkiCertificateDataSource);
    bind(pkiTypes.PkiCertificateLoader).to(DefaultPkiCertificateLoader);
  });
