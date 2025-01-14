import { type HexaString } from "@ledgerhq/device-management-kit";

export type Signature = { r: HexaString; s: HexaString; v: number };

export type PartialSignature = {
  inputIndex: number;
  pubkey: Uint8Array;
  signature: Uint8Array;
  tapleafHash?: Uint8Array;
};

export type MusigPubNonce = {
  inputIndex: number;
  participantPubkey: Uint8Array;
  aggregatedPubkey: Uint8Array;
  tapleafHash?: Uint8Array;
  pubnonce: Uint8Array;
};

export type MusigPartialSignature = {
  inputIndex: number;
  participantPubkey: Uint8Array;
  aggregatedPubkey: Uint8Array;
  tapleafHash?: Uint8Array;
  partialSignature: Uint8Array;
};

export type PsbtSignature =
  | PartialSignature
  | MusigPartialSignature
  | MusigPubNonce;

export const isPartialSignature = (
  psbtSignature: PsbtSignature,
): psbtSignature is PartialSignature => "pubkey" in psbtSignature;
