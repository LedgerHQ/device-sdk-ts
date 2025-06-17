import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type NetworkDescriptor = {
  descriptorType: string;
  descriptorVersion: string;
  data: string;
  signatures: {
    prod: string;
    test: string;
  };
  icon: string | undefined;
};

export type NetworkConfiguration = {
  id: string;
  descriptors: Record<DeviceModelId, NetworkDescriptor>;
};

export interface NetworkConfigurationLoader {
  load(chainId: number): Promise<NetworkConfiguration | null>;
}
