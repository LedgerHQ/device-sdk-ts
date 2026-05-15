import { ContainerModule } from "inversify";

import { HttpAleoTokenDataSource } from "@/aleoToken/data/HttpAleoTokenDataSource";
import { aleoTokenTypes } from "@/aleoToken/di/aleoTokenTypes";
import { AleoTokenContextLoader } from "@/aleoToken/domain/AleoTokenContextLoader";

export const aleoTokenModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(aleoTokenTypes.AleoTokenDataSource).to(HttpAleoTokenDataSource);
    bind(aleoTokenTypes.AleoTokenContextLoader).to(AleoTokenContextLoader);
  });
