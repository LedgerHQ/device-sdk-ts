export const gatedSigningTypes = {
  // Ethereum
  GatedDescriptorDataSource: Symbol.for("GatedDescriptorDataSource"),
  GatedSigningContextLoader: Symbol.for("GatedSigningContextLoader"),
  GatedSigningTypedDataContextLoader: Symbol.for(
    "GatedSigningTypedDataContextLoader",
  ),
  // Solana
  SolanaGatedDescriptorDataSource: Symbol.for(
    "SolanaGatedDescriptorDataSource",
  ),
  SolanaGatedSigningContextLoader: Symbol.for(
    "SolanaGatedSigningContextLoader",
  ),
};
