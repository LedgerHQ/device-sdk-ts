import { ContainerModule } from "inversify";

import { psbtTypes } from "@internal/psbt/di/psbtTypes";
import { DefaultKeySerializer } from "@internal/psbt/service/key/DefaultKeySerializer";
import { DefaultKeyPairSerializer } from "@internal/psbt/service/key-pair/DefaultKeyPairSerializer";
import { DefaultPsbtMapper } from "@internal/psbt/service/psbt/DefaultPsbtMapper";
import { DefaultPsbtSerializer } from "@internal/psbt/service/psbt/DefaultPsbtSerializer";
import { DefaultPsbtV2Normalizer } from "@internal/psbt/service/psbt/DefaultPsbtV2Normalizer";
import { DefaultValueFactory } from "@internal/psbt/service/value/DefaultValueFactory";
import { DefaultValueParser } from "@internal/psbt/service/value/DefaultValueParser";

export const psbtModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(psbtTypes.KeySerializer).to(DefaultKeySerializer);
      bind(psbtTypes.KeyPairSerializer).to(DefaultKeyPairSerializer);
      bind(psbtTypes.PsbtMapper).to(DefaultPsbtMapper);
      bind(psbtTypes.PsbtV2Normalizer).to(DefaultPsbtV2Normalizer);
      bind(psbtTypes.PsbtSerializer).to(DefaultPsbtSerializer);
      bind(psbtTypes.ValueFactory).to(DefaultValueFactory);
      bind(psbtTypes.ValueParser).to(DefaultValueParser);
    },
  );
