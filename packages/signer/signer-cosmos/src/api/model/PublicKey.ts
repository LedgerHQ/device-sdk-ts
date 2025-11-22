export type PublicKey<T = string> = {
  readonly publicKey: T;
  readonly address: T;
  readonly chainCode?: T;
};
