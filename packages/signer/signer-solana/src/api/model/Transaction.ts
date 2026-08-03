/**
 * Serialized Solana transaction bytes. Accepts both raw message bytes
 * (`tx.serializeMessage()`) and the full wire-format transaction
 * (`tx.serialize()`). When the full wire-format is provided, co-signer
 * signatures are forwarded to Transaction Check automatically and the
 * message bytes are extracted before being sent to the device.
 */
export type Transaction = Uint8Array;
