import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type DynamicNetworkDescriptor = {
  descriptorType: string;
  descriptorVersion: string;
  data: string;
  signatures: {
    prod: string;
    test: string;
  };
  icon: string | undefined;
};

export type LowercaseDeviceModelId = Lowercase<DeviceModelId>;

export type DynamicNetworkConfiguration = {
  id: string;
  descriptors: Record<LowercaseDeviceModelId, DynamicNetworkDescriptor>;
};
