export type ProvideNetworkConfigurationCommandArgs = {
  /**
   * The network configuration data to provide in chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the network configuration
   */
  readonly isFirstChunk: boolean;
};
