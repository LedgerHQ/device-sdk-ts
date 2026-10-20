import { type Message, PublicKey } from "@solana/web3.js";

// Solana transaction v1 (SIMD-0385) message fixtures. A v1 message is laid out
// as: version 0x81, a 3-byte header, a u32 LE config mask, a 32-byte lifetime
// token, u8 instruction and address counts, the addresses, 4 bytes per set
// mask bit of config values, one 4-byte header per instruction (program index,
// account count, u16 LE data length), then each instruction's account indexes
// and data. Signatures follow the message on the wire and are not part of it.

const concat = (...parts: ArrayLike<number>[]) =>
  Uint8Array.from(parts.flatMap((part) => Array.from(part)));

/**
 * The spec's worked example: a 1,000,000-lamport System transfer from
 * `0x11…` to `0x22…`, blockhash `0xaa…`, priority fee 5,000 lamports, CU limit
 * 450 and loaded-accounts-data limit 32 KiB (config mask `0x0f`). 172 bytes.
 */
export const SPEC_V1_MESSAGE_HEX =
  "810100010f000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" +
  "0103" +
  "1111111111111111111111111111111111111111111111111111111111111111" +
  "2222222222222222222222222222222222222222222222222222222222222222" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "8813000000000000c20100000080000002020c0000010200000040420f0000000000";

const fromHex = (hex: string) =>
  Uint8Array.from(hex.match(/../g)!.map((byte) => parseInt(byte, 16)));

export const SPEC_V1_MESSAGE = fromHex(SPEC_V1_MESSAGE_HEX);

// Shared with the device test vectors: two real mainnet v1 transactions, each
// cut at `length - 64 * signatureCount` to keep the message only.

/**
 * Mainnet v1 transaction `4DYLiERU…aDgJq17x` cut to its 675-byte message:
 * mask `0x1c` (CU limit 802, loaded data 384433, heap 32768), 7 addresses,
 * 3 instructions, no ComputeBudget instruction and no priority fee.
 */
export const MAINNET_V1_MESSAGE_675 = fromHex(
  "810100041c00000059ec93e26bce14171fb983347e582451381bf47b63566b417ac0358ce9a7" +
    "f935030768a2dd43e2f07c3bd7f4f278523fb53032e1154d5870ba0e765051c1c22d825b8907" +
    "7d55a5bb1330763eb767f55ec077b41a0d075f7de1d73fbaca3c63d55471f2c87788bc41e59d" +
    "483c7ee02a5d28d44f85139a3d385858ca8026dd4183e4020000000000000000000000000000" +
    "00000000000000000000000000000000000006a7d51718c774c928566398691d5eb68b5eb8a3" +
    "9b4b6d5c73555b21000000000a7f425fdee966c8a668f8d29fe22678720ececfa4f524467074" +
    "f27c6ecd1b4b0bf8fc92d4deb3145a08ee0b6bba37979146dd5266832029af215b9f1505cc9a" +
    "22030000b1dd050000800000050109000602670103020c00040447e9cd1a0000000000023700" +
    "344881b83900000043e9cd1a00000000222000c3ecd92b867c46be1d00c3ec99961e7e46be01" +
    "00c3ecab24417746be0500c3ecc991881246be0d00c3ecf3843b6446be1e00c3ecab97fa7446" +
    "be1a00c3ec43eb437746be0900c3ecab371e7746be0e00c3ec0d867d7646be1100c3ecdd7411" +
    "6546be1200c3ecdd74116546be0600c3ec55385f7746be0200c3ec17653b7646be0f00c3ecb9" +
    "4b417746be1400c3ec210d047646be1f00c3ec45ad787146be0400c3ecf321417746be0000c3" +
    "ec8125417746be0700c3ecf7a9597746be1500c3ec6bbe7d7746be1b00c3ec2f15877446be22" +
    "00c3ec0b24f47246be2300c3ec950c167f46be0b00c3ec8d995e7746be1600c3ecf73e2f7746" +
    "be0a00c3ecfd485f7746be0c00c3ec0b019eda4abe2100c3ecd50af57246be1300c3ecd5512b" +
    "7746be2400c3ec35f5907546be1000c3ec19de4f7746be0800c3ec9157cc7546be0300c3ec21" +
    "71537746be1c00c3ec7b61976146be00010200000040e2000000000000",
);

/**
 * Mainnet v1 transaction `4rqpsagr…uj38xbVg` cut to its 288-byte message:
 * mask `0x0c` (CU limit 151, loaded data 1024), 2 instructions, no
 * ComputeBudget instruction and no priority fee.
 */
export const MAINNET_V1_MESSAGE_288 = fromHex(
  "810100020c000000b187de2bc3bb33054301e2c4a93cb449e61d62bb6dd1202269c3450b6c1d" +
    "006f02048c5a6b52e0b452d86dd1b5316bcf6cce69fc9bfd18cd01088b928887addcde9988f1" +
    "ffa3a2dfe617bdc4e3573251a322e3fcae81e5a457390e64751c00a465e20000000000000000" +
    "000000000000000000000000000000000000000000000000902cccc570d89044906dca0b826c" +
    "d12101ea9e5854f59bc38901954290609160970000000004000002020c000300580000010200" +
    "000048e80100000000004154495001010109db79c78a5b3d57421690b87bf8898cf700000000" +
    "0000000000000000000000000000000000000000000000000000000000000000000000000000" +
    "00000000000001a0ce381f9117a9402ff1033295e884",
);

/** Byte offsets of the spec message's fields. */
export const SPEC_V1_OFFSETS = {
  version: 0,
  numSignerAccounts: 1,
  numReadonlySignerAccounts: 2,
  numReadonlyNonSignerAccounts: 3,
  configMask: 4,
  lifetimeToken: 8,
  numInstructions: 40,
  numAddresses: 41,
  addresses: 42,
  configValues: 138,
  instructionHeaders: 154,
  instructionPayloads: 158,
} as const;

/** A copy of `message` with `bytes` written at `offset`. */
export const withBytes = (
  message: Uint8Array,
  offset: number,
  bytes: ArrayLike<number>,
) => {
  const copy = Uint8Array.from(message);
  copy.set(bytes, offset);
  return copy;
};

/** A copy of `message` with one byte replaced. */
export const withByte = (message: Uint8Array, offset: number, value: number) =>
  withBytes(message, offset, [value]);

/** A copy of `message` with `extra` bytes appended. */
export const withTrailingBytes = (message: Uint8Array, extra: number[]) =>
  concat(message, extra);

export type V1InstructionInput = {
  programIndex: number;
  accounts: number[];
  data: ArrayLike<number>;
};

export type V1MessageInput = {
  numSignerAccounts: number;
  numReadonlySignerAccounts: number;
  numReadonlyNonSignerAccounts: number;
  configMask: number;
  lifetimeToken: ArrayLike<number>;
  addresses: ArrayLike<number>[];
  /** Raw config value bytes, 4 per set mask bit (the priority fee takes 8). */
  configValues: ArrayLike<number>;
  instructions: V1InstructionInput[];
};

const u16le = (value: number) => [value & 0xff, (value >> 8) & 0xff];
/** A u32 as 4 little-endian bytes. */
export const u32le = (value: number) => [
  ...u16le(value & 0xffff),
  ...u16le(value >>> 16),
];

/**
 * Encodes a v1 message byte for byte, without any validation, so tests can
 * build both valid messages and messages that break the spec's rules.
 * Counts that do not fit their field are truncated to it.
 */
export const encodeV1Message = (input: V1MessageInput): Uint8Array =>
  concat(
    [
      0x81,
      input.numSignerAccounts,
      input.numReadonlySignerAccounts,
      input.numReadonlyNonSignerAccounts,
    ],
    u32le(input.configMask),
    input.lifetimeToken,
    [input.instructions.length & 0xff, input.addresses.length & 0xff],
    ...input.addresses,
    input.configValues,
    ...input.instructions.map(({ programIndex, accounts, data }) => [
      programIndex,
      accounts.length,
      ...u16le(data.length),
    ]),
    ...input.instructions.flatMap(({ accounts, data }) => [accounts, data]),
  );

/** 32-byte address filled with `fill`. */
export const filledAddress = (fill: number) => new Uint8Array(32).fill(fill);

/** The spec message's fields, as `encodeV1Message` input. */
export const SPEC_V1_INPUT: V1MessageInput = {
  numSignerAccounts: 1,
  numReadonlySignerAccounts: 0,
  numReadonlyNonSignerAccounts: 1,
  configMask: 0x0f,
  lifetimeToken: filledAddress(0xaa),
  addresses: [filledAddress(0x11), filledAddress(0x22), filledAddress(0x00)],
  configValues: [
    ...[0x88, 0x13, 0, 0, 0, 0, 0, 0], // priority fee 5000 (u64)
    ...u32le(450), // CU limit
    ...u32le(32768), // loaded accounts data limit
  ],
  instructions: [
    {
      programIndex: 2,
      accounts: [0, 1],
      data: [2, 0, 0, 0, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0], // Transfer 1_000_000
    },
  ],
};

/**
 * Re-encodes a compiled legacy message as v1: same header, accounts,
 * blockhash and instructions, no config. Legacy key order (writable signers,
 * readonly signers, writable non-signers, readonly non-signers) is also the
 * v1 order, so both describe the same transaction.
 */
export const v1FromLegacyMessage = (message: Message): Uint8Array =>
  encodeV1Message({
    numSignerAccounts: message.header.numRequiredSignatures,
    numReadonlySignerAccounts: message.header.numReadonlySignedAccounts,
    numReadonlyNonSignerAccounts: message.header.numReadonlyUnsignedAccounts,
    configMask: 0,
    lifetimeToken: new PublicKey(message.recentBlockhash).toBytes(),
    addresses: message.accountKeys.map((key) => key.toBytes()),
    configValues: [],
    instructions: message.compiledInstructions.map(
      ({ programIdIndex, accountKeyIndexes, data }) => ({
        programIndex: programIdIndex,
        accounts: accountKeyIndexes,
        data,
      }),
    ),
  });
