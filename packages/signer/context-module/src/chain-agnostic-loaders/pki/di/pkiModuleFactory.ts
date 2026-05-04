import { ContainerModule } from "inversify";

import { HttpPkiCertificateDataSource } from "@/chain-agnostic-loaders/pki/data/HttpPkiCertificateDataSource";
import { DefaultPkiCertificateLoader } from "@/chain-agnostic-loaders/pki/domain/DefaultPkiCertificateLoader";

import { pkiTypes } from "./pkiTypes";

export const nanoPkiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(pkiTypes.PkiCertificateDataSource).to(HttpPkiCertificateDataSource);
    bind(pkiTypes.PkiCertificateLoader).to(DefaultPkiCertificateLoader);
  });
