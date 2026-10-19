/**
 * Token account → owning wallet bindings (both base58) that clear-signing
 * descriptors attested to the device: `TOKEN_ACCOUNT_STATE` in the generic
 * flow, the owner-info `TRUSTED_NAME` in the basic one.
 */
export type TokenAccountOwners = Readonly<Record<string, string>>;

export const NO_TOKEN_ACCOUNT_OWNERS: TokenAccountOwners = {};
