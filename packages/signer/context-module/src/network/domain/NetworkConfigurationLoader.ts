import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type NetworkDescriptor = {
  descriptorType: string;
  descriptorVersion: string;
  data: string;
  signatures: {
    prod: string;
    test: string;
  };
};

export type NetworkIcon = {
  flex: string;
  stax: string;
};

export type NetworkConfiguration = {
  id: string;
  descriptors: Record<DeviceModelId, NetworkDescriptor>;
  icons: NetworkIcon;
};

export interface NetworkConfigurationLoader {
  load(chainId: number): Promise<NetworkConfiguration | null>;
}