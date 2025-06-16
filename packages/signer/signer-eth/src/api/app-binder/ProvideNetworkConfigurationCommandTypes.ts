export enum NetworkConfigurationType {
  CONFIGURATION = 0x00,
  ICON = 0x01,
}

export type ProvideNetworkConfigurationCommandArgs = {
  /**
   * The network configuration data to provide in chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the network configuration
   */
  readonly isFirstChunk: boolean;
  /**
   * The type of network configuration being provided
   */
  readonly configurationType: NetworkConfigurationType;
};
