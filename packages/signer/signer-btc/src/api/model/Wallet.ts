export enum DefaultDescriptorTemplate {
  LEGACY = "pkh(@0/**)",
  NESTED_SEGWIT = "sh(wpkh(@0/**))",
  NATIVE_SEGWIT = "wpkh(@0/**)",
  TAPROOT = "tr(@0/**)",
}

/**
 * Default wallets that can be used without registration in the device.
 */
export class DefaultWallet {
  constructor(
    // Derivation path without master key respresentation.
    // Format example: /44'/0'/0'
    public derivationPath: string,
    public template: DefaultDescriptorTemplate,
  ) {}
}

/**
 * Custom wallet registered in the device.
 * It must be stored on client side after registration for further usages.
 */
export class RegisteredWallet {
  constructor(
    public name: string,
    public descriptorTemplate: string,
    public keys: string[],
    public hmac: Uint8Array,
  ) {}
}

/**
 * The Bitcon hardware app uses a descriptors-like thing to describe
 * how to construct output scripts from keys. A "Wallet Policy" consists
 * of a "Descriptor Template" and a list of "keys". A key is basically
 * a serialized BIP32 extended public key with some added derivation path
 * information. This is documented at
 * https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/wallet.md
 */
export class WalletPolicy {
  constructor(
    public name: string,
    public descriptorTemplate: string,
    public keys: string[],
  ) {}
}

export type Wallet = DefaultWallet | RegisteredWallet;
