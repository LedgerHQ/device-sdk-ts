/**
 * Domain model representing the configuration for the signer service
 */
export interface SignerConfig {
    originToken: string;
    gated: boolean;
}
