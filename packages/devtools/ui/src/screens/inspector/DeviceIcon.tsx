import React from "react";
import {
  Devices,
  Flex,
  Nano,
  NanoGen5,
  Stax,
} from "@ledgerhq/lumen-ui-react/symbols";

const MODEL_ICONS: Record<string, typeof Devices> = {
  nanoS: Nano,
  nanoSP: Nano,
  nanoX: Nano,
  stax: Stax,
  flex: Flex,
  apexp: NanoGen5,
};

export const DeviceIcon: React.FC<{ modelId: string; className?: string }> = ({
  modelId,
  className = "",
}) => {
  const Icon = MODEL_ICONS[modelId] ?? Devices;
  return <Icon size={20} className={`shrink-0 text-muted ${className}`} />;
};
