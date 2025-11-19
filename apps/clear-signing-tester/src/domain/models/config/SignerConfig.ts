/**
 * Domain model representing the configuration for the signer service
 */
export type SignerConfig = {
  originToken: string;
  gated: boolean;
};
