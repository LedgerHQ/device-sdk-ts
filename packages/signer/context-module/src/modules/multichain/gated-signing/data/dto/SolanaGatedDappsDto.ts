import {
  array,
  Codec,
  type GetType,
  optional,
  record,
  string,
  unknown,
} from "purify-ts";

/**
 * Solana reuses the Ethereum gating format: the same `gated_dapps` endpoint,
 * keyed by program ID (Ethereum: contract address) then by selector. The
 * selector holds the instruction discriminator as hex; an empty selector means
 * the descriptor targets the whole program. An entry without a selector is
 * skipped.
 */
export const solanaGatedDescriptorEntryCodec = Codec.interface({
  selector: optional(string),
  descriptor: string,
  signatures: optional(record(string, string)),
});

// Entries stay unknown here and are decoded one by one, so one malformed
// entry is skipped instead of failing the whole response.
const solanaGatedDappsItemCodec = Codec.interface({
  gated_descriptors: record(string, unknown),
});

export const solanaGatedDappsDtoCodec = array(solanaGatedDappsItemCodec);

export type SolanaGatedDescriptorEntryDto = GetType<
  typeof solanaGatedDescriptorEntryCodec
>;

export type SolanaGatedDappsDto = GetType<typeof solanaGatedDappsDtoCodec>;
