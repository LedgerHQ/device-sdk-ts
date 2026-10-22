import { ContainerModule } from "inversify";

import { HttpEip712V2DescriptorDataSource } from "@/modules/ethereum/typed-data-v2/data/HttpEip712V2DescriptorDataSource";
import { typedDataV2Types } from "@/modules/ethereum/typed-data-v2/di/typedDataV2Types";
import { Eip712V2ContextLoader } from "@/modules/ethereum/typed-data-v2/domain/Eip712V2ContextLoader";

export const typedDataV2ModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(typedDataV2Types.Eip712V2DescriptorDataSource).to(
      HttpEip712V2DescriptorDataSource,
    );
    bind(typedDataV2Types.Eip712V2ContextLoader).to(Eip712V2ContextLoader);
  });
