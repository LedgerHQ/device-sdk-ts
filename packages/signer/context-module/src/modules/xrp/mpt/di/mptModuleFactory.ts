import { ContainerModule } from "inversify";

import { HttpMptDataSource } from "@/modules/xrp/mpt/data/HttpMptDataSource";
import { mptTypes } from "@/modules/xrp/mpt/di/mptTypes";
import { MptContextLoader } from "@/modules/xrp/mpt/domain/MptContextLoader";

export const mptModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(mptTypes.MptDataSource).to(HttpMptDataSource);
    bind(mptTypes.MptContextLoader).to(MptContextLoader);
  });
