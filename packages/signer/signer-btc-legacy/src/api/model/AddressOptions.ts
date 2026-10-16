export type AddressFormat = "legacy" | "p2sh" | "bech32" | "cashaddr";

export type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
  addressFormat?: AddressFormat;
};
