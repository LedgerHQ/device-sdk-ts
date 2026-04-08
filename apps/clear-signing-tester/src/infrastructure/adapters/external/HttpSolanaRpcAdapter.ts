import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type SolanaRpcAdapter } from "@root/src/domain/adapters/SolanaRpcAdapter";
import { type SolanaRpcConfig } from "@root/src/domain/models/config/SolanaRpcConfig";
import { type SolanaTransactionData } from "@root/src/domain/models/SolanaTransactionData";

const DEFAULT_SCAN_LIMIT = 500;
const BATCH_SIZE = 20;
const METADATA_SERVICE_URL = "https://nft.api.live.ledger.com";

type InstructionInfo = {
  programId: string;
  dataHex: string;
};

/**
 * Instructions the Ledger Solana app has explicit clear-sign display
 * templates for.  During transaction scanning, we only need to find
 * one of these from the **target program** — the rest of the transaction
 * is stripped during distillation.
 *
 * Discriminator formats:
 * - System/Stake: u32 LE (4 bytes, 8 hex chars)
 * - SPL Token / Token-2022: 1 byte (2 hex chars)
 */

/**
 * Subset of CLEAR_SIGNABLE_INSTRUCTIONS that the Ledger Solana app has
 * explicit clear-sign display templates for.  A transaction must contain
 * at least one of these to be considered clear-signable; auxiliary-only
 * transactions (e.g. standalone ATA creation) are rejected.
 */
// All instructions the Ledger Solana app can parse and clear-sign.
// Source: https://github.com/LedgerHQ/app-solana (libsol/*_instruction.{h,c})
// Discriminators: System/Stake use u32 LE, SPL Token uses u8.
const PRIMARY_CLEAR_SIGNABLE_INSTRUCTIONS = new Map<string, string[]>([
  [
    "11111111111111111111111111111111",
    [
      "00000000", // CreateAccount
      "01000000", // Assign
      "02000000", // Transfer
      "03000000", // CreateAccountWithSeed
      "04000000", // AdvanceNonceAccount
      "05000000", // WithdrawNonceAccount
      "06000000", // InitializeNonceAccount
      "07000000", // AuthorizeNonceAccount
      "08000000", // Allocate
      "09000000", // AllocateWithSeed
    ],
  ],
  [
    "Stake11111111111111111111111111111111111111",
    [
      "00000000", // Initialize
      "01000000", // Authorize
      "02000000", // DelegateStake
      "03000000", // Split
      "04000000", // Withdraw
      "05000000", // Deactivate
      "06000000", // SetLockup
      "07000000", // Merge
      "09000000", // InitializeChecked
      "0a000000", // AuthorizeChecked
      "0c000000", // SetLockupChecked
    ],
  ],
  [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    [
      "00", // InitializeMint
      "01", // InitializeAccount
      "05", // Revoke
      "06", // SetAuthority
      "09", // CloseAccount
      "0a", // FreezeAccount
      "0b", // ThawAccount
      "0c", // TransferChecked
      "0d", // ApproveChecked
      "0e", // MintToChecked
      "0f", // BurnChecked
      "10", // InitializeAccount2
      "11", // SyncNative
    ],
  ],
  [
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    [
      "00", // InitializeMint
      "01", // InitializeAccount
      "05", // Revoke
      "06", // SetAuthority
      "09", // CloseAccount
      "0a", // FreezeAccount
      "0b", // ThawAccount
      "0c", // TransferChecked
      "0d", // ApproveChecked
      "0e", // MintToChecked
      "0f", // BurnChecked
      "10", // InitializeAccount2
      "11", // SyncNative
      "1a01", // TransferCheckedWithFee
    ],
  ],
]);

// Programs whose instructions should also be accepted as "primary" when
// fetching for a given target.  Stake operations typically combine
// System + Stake instructions in a single transaction.
const COMPANION_PROGRAMS: Record<string, string[]> = {
  Stake11111111111111111111111111111111111111: [
    "11111111111111111111111111111111",
  ],
};

const PROGRAM_LABELS: Record<string, string> = {
  "11111111111111111111111111111111": "system",
  Stake11111111111111111111111111111111111111: "stake",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "spl-token",
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: "token-2022",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "associated-token",
  ComputeBudget111111111111111111111111111111: "compute-budget",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "memo",
  Memo1UhkJBfCVP8cjhmS7ZS8LDhGnGkicaQzq1y1qYVP: "memo",
};

const INSTRUCTION_NAMES: Record<string, Record<string, string>> = {
  "11111111111111111111111111111111": {
    "00000000": "CreateAccount",
    "01000000": "Assign",
    "02000000": "Transfer",
    "03000000": "CreateAccountWithSeed",
    "04000000": "AdvanceNonceAccount",
    "05000000": "WithdrawNonceAccount",
    "06000000": "InitializeNonceAccount",
    "07000000": "AuthorizeNonceAccount",
    "08000000": "Allocate",
    "09000000": "AllocateWithSeed",
  },
  Stake11111111111111111111111111111111111111: {
    "00000000": "Initialize",
    "01000000": "Authorize",
    "02000000": "DelegateStake",
    "03000000": "Split",
    "04000000": "Withdraw",
    "05000000": "Deactivate",
    "06000000": "SetLockup",
    "07000000": "Merge",
    "09000000": "InitializeChecked",
    "0a000000": "AuthorizeChecked",
    "0c000000": "SetLockupChecked",
  },
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: {
    "00": "InitializeMint",
    "01": "InitializeAccount",
    "05": "Revoke",
    "06": "SetAuthority",
    "09": "CloseAccount",
    "0a": "FreezeAccount",
    "0b": "ThawAccount",
    "0c": "TransferChecked",
    "0d": "ApproveChecked",
    "0e": "MintToChecked",
    "0f": "BurnChecked",
    "10": "InitializeAccount2",
    "11": "SyncNative",
  },
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: {
    "00": "InitializeMint",
    "01": "InitializeAccount",
    "05": "Revoke",
    "06": "SetAuthority",
    "09": "CloseAccount",
    "0a": "FreezeAccount",
    "0b": "ThawAccount",
    "0c": "TransferChecked",
    "0d": "ApproveChecked",
    "0e": "MintToChecked",
    "0f": "BurnChecked",
    "10": "InitializeAccount2",
    "11": "SyncNative",
    "1a01": "TransferCheckedWithFee",
  },
};

// Token instructions that require metadata from the context module to
// clear-sign.  For these, we probe the metadata service during filtering
// and skip transactions where the token is unknown.
const TOKEN_PROGRAMS_NEEDING_METADATA = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);
const INSTRUCTIONS_NEEDING_METADATA = new Set([
  "0c", // TransferChecked
  "0d", // ApproveChecked
  "0e", // MintToChecked
  "0f", // BurnChecked
  "1a01", // TransferCheckedWithFee (Token-2022)
]);

function resolveInstructionName(
  programId: string,
  dataHex: string,
): string | undefined {
  const names = INSTRUCTION_NAMES[programId];
  if (!names) return undefined;
  for (const [prefix, name] of Object.entries(names)) {
    if (dataHex.startsWith(prefix)) return name;
  }
  return undefined;
}

type RpcResponse<T> = {
  jsonrpc: string;
  id: number;
  result: T;
  error?: { code: number; message: string };
};

type SignatureInfo = {
  signature: string;
  err: unknown;
};

type RpcTransactionResult = {
  transaction: [string, string]; // [base64_data, "base64"]
  meta: {
    err: unknown;
    loadedAddresses?: {
      writable: string[];
      readonly: string[];
    };
  } | null;
};

@injectable()
export class HttpSolanaRpcAdapter implements SolanaRpcAdapter {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SolanaRpcConfig)
    private readonly rpcConfig: SolanaRpcConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("solana-rpc-adapter");
  }

  async fetchClearSignableTransactions(
    address: string,
    limit: number = DEFAULT_SCAN_LIMIT,
    samplesPerInstruction: number = 1,
  ): Promise<SolanaTransactionData[]> {
    this.logger.info(
      `Fetching up to ${limit} signatures for address ${address}`,
    );

    const signatures = await this.getSignaturesForAddress(address, limit);
    const successfulSigs = signatures.filter((s) => s.err === null);

    this.logger.info(
      `Found ${successfulSigs.length} successful transactions out of ${signatures.length} total`,
    );

    if (successfulSigs.length === 0) {
      return [];
    }

    const clearSignable: SolanaTransactionData[] = [];

    for (let i = 0; i < successfulSigs.length; i += BATCH_SIZE) {
      const batch = successfulSigs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((sig) => this.fetchAndClassify(sig.signature, address)),
      );
      for (const result of results) {
        if (result) {
          clearSignable.push(result);
        }
      }
    }

    this.logger.info(
      `${clearSignable.length} out of ${successfulSigs.length} transactions are clear-signable`,
    );

    return this.pickPerCategory(clearSignable, samplesPerInstruction);
  }

  private async fetchAndClassify(
    signature: string,
    targetProgramId: string,
  ): Promise<SolanaTransactionData | null> {
    try {
      const tx = await this.getTransaction(signature);
      if (!tx || !tx.meta || tx.meta.err !== null) {
        return null;
      }

      const [base64Data] = tx.transaction;
      let rawBytes: Buffer = Buffer.from(base64Data, "base64");

      // The Ledger Solana app does not support v0 (versioned) transactions.
      // Convert v0 → legacy so the device can parse and clear-sign them.
      if (this.isVersionedTransaction(rawBytes)) {
        const loadedAddresses = tx.meta.loadedAddresses ?? {
          writable: [],
          readonly: [],
        };
        const legacy = this.convertV0ToLegacy(rawBytes, loadedAddresses);
        if (!legacy) {
          this.logger.debug(
            `Skipping tx ${signature.slice(0, 12)}: failed v0→legacy conversion`,
          );
          return null;
        }
        rawBytes = legacy;
      }

      const instructions = this.extractInstructions(rawBytes);
      if (instructions.length === 0) {
        return null;
      }

      if (
        !this.hasPrimaryFromTarget(instructions, targetProgramId, signature)
      ) {
        return null;
      }

      // Distil: strip non-essential instructions, keeping only the
      // primary clear-signable one from the target program and its
      // referenced accounts.  This produces a minimal single-instruction
      // transaction the Ledger app can parse.
      const distilled = this.distillPrimaryInstruction(
        rawBytes,
        targetProgramId,
      );
      if (!distilled) {
        this.logger.debug(
          `Skipping tx ${signature.slice(0, 12)}: distillation failed`,
        );
        return null;
      }

      // For token instructions that need metadata (TransferChecked, etc.),
      // probe the metadata service to check the token is known.
      // Unknown tokens would be blind-signed by the firmware.
      if (await this.isUnsupportedTokenInstruction(distilled, signature)) {
        return null;
      }

      const programLabel =
        PROGRAM_LABELS[distilled.programId] ?? distilled.programId;
      const instrName = resolveInstructionName(
        distilled.programId,
        distilled.dataHex,
      );
      const category = instrName
        ? `${programLabel}:${instrName}`
        : programLabel;

      return {
        rawTx: distilled.buffer.toString("base64"),
        signature,
        category,
      };
    } catch (error) {
      this.logger.debug(`Failed to fetch/classify tx ${signature}`, {
        data: { error },
      });
      return null;
    }
  }

  /**
   * Extract top-level instructions (programId + data hex) from raw transaction bytes.
   * Handles both legacy and v0 (versioned) transaction formats.
   * Inner (CPI) instructions are ignored — the Solana app evaluates
   * clear-signability based on the top-level message instructions only.
   *
   * For v0 transactions, program IDs resolved from Address Lookup Tables
   * are returned with a `UNRESOLVED_ALT:<index>` sentinel so that
   * {@link isClearSignable} rejects transactions with unresolvable programs.
   */
  private extractInstructions(rawBytes: Buffer): InstructionInfo[] {
    const instructions: InstructionInfo[] = [];

    try {
      let cursor = 0;

      const { length: sigCount, size: sigLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += sigLenSize + sigCount * 64;

      const firstByte = rawBytes[cursor]!;
      const isVersioned = (firstByte & 0x80) !== 0;
      if (isVersioned) {
        cursor += 1;
      }

      // Message header
      cursor += 3;

      // Static account keys (for v0 these are only the static portion)
      const { length: accountCount, size: accountLenSize } =
        this.decodeCompactU16(rawBytes, cursor);
      cursor += accountLenSize;

      const accountKeys: string[] = [];
      for (let i = 0; i < accountCount; i++) {
        const keyBytes = rawBytes.slice(cursor, cursor + 32);
        accountKeys.push(this.toBase58(keyBytes));
        cursor += 32;
      }

      // Skip recent blockhash
      cursor += 32;

      // Instructions
      const { length: ixCount, size: ixLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += ixLenSize;

      for (let i = 0; i < ixCount; i++) {
        const programIdIndex = rawBytes[cursor]!;
        cursor += 1;

        // Skip accounts compact-array
        const { length: acctLen, size: acctLenSize } = this.decodeCompactU16(
          rawBytes,
          cursor,
        );
        cursor += acctLenSize + acctLen;

        // Read data compact-array
        const { length: dataLen, size: dataLenSize } = this.decodeCompactU16(
          rawBytes,
          cursor,
        );
        cursor += dataLenSize;

        const dataBytes = rawBytes.slice(cursor, cursor + dataLen);
        cursor += dataLen;

        const programId =
          programIdIndex < accountKeys.length
            ? accountKeys[programIdIndex]!
            : `UNRESOLVED_ALT:${programIdIndex}`;

        instructions.push({
          programId,
          dataHex: dataBytes.toString("hex"),
        });
      }
    } catch {
      this.logger.debug("Failed to parse transaction bytes");
    }

    return instructions;
  }

  /**
   * Check whether the transaction contains a primary clear-signable
   * instruction from the **target program**.  Since we distil down to
   * a single instruction, we only need to verify the target instruction
   * exists — the rest of the transaction is discarded.
   */
  private hasPrimaryFromTarget(
    instructions: InstructionInfo[],
    targetProgramId: string,
    signature?: string,
  ): boolean {
    const accepted = new Set([
      targetProgramId,
      ...(COMPANION_PROGRAMS[targetProgramId] ?? []),
    ]);

    for (const ix of instructions) {
      if (!accepted.has(ix.programId)) continue;
      const primaryPrefixes = PRIMARY_CLEAR_SIGNABLE_INSTRUCTIONS.get(
        ix.programId,
      );
      if (primaryPrefixes?.some((prefix) => ix.dataHex.startsWith(prefix))) {
        return true;
      }
    }

    this.logger.debug(
      `Rejected tx ${signature?.slice(0, 12) ?? "?"}: no primary instruction from target program`,
    );
    return false;
  }

  private pickPerCategory(
    txs: SolanaTransactionData[],
    count: number,
  ): SolanaTransactionData[] {
    const byCategory = new Map<string, SolanaTransactionData[]>();
    for (const tx of txs) {
      const list = byCategory.get(tx.category) ?? [];
      list.push(tx);
      byCategory.set(tx.category, list);
    }

    const selected: SolanaTransactionData[] = [];
    for (const [category, list] of byCategory) {
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      const picks = shuffled.slice(0, count);
      selected.push(...picks);
      this.logger.debug(
        `Category "${category}": picked ${picks.length} of ${list.length} transactions`,
      );
    }
    return selected;
  }

  /**
   * Returns true if this is a token instruction that needs metadata but
   * the metadata service doesn't support the token.  The first instruction
   * account (source token account) is probed against the metadata service.
   */
  private async isUnsupportedTokenInstruction(
    distilled: {
      programId: string;
      dataHex: string;
      accountKeys: string[];
    },
    signature: string,
  ): Promise<boolean> {
    if (!TOKEN_PROGRAMS_NEEDING_METADATA.has(distilled.programId)) return false;

    const needsMetadata = [...INSTRUCTIONS_NEEDING_METADATA].some((prefix) =>
      distilled.dataHex.startsWith(prefix),
    );
    if (!needsMetadata) return false;

    const sourceTokenAccount = distilled.accountKeys[0];
    if (!sourceTokenAccount) return true;

    try {
      const response = await axios.head(
        `${METADATA_SERVICE_URL}/v2/solana/owner/${sourceTokenAccount}`,
        { timeout: 5000, validateStatus: () => true },
      );
      if (response.status === 200) return false;
      this.logger.debug(
        `Skipping tx ${signature.slice(0, 12)}: token account ${sourceTokenAccount.slice(0, 12)}... not in metadata service (${response.status})`,
      );
      return true;
    } catch {
      this.logger.debug(
        `Skipping tx ${signature.slice(0, 12)}: metadata service probe failed`,
      );
      return true;
    }
  }

  // --- Transaction distillation ---

  /**
   * Extract the primary clear-signable instruction from a legacy transaction
   * and build a minimal transaction containing only that instruction and its
   * referenced account keys.  This produces a clean, fixture-like transaction
   * the Ledger Solana app can parse and clear-sign.
   */
  private distillPrimaryInstruction(
    rawBytes: Buffer,
    targetProgramId: string,
  ): {
    buffer: Buffer;
    programId: string;
    dataHex: string;
    accountKeys: string[];
  } | null {
    try {
      let cursor = 0;

      // --- Parse legacy transaction ---
      const { length: sigCount, size: sigLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += sigLenSize + sigCount * 64;

      const numReqSig = rawBytes[cursor]!;
      const numRoSig = rawBytes[cursor + 1]!;
      const numRoUnsig = rawBytes[cursor + 2]!;
      cursor += 3;

      const { length: keyCount, size: keyLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += keyLenSize;

      const keys: Buffer[] = [];
      for (let i = 0; i < keyCount; i++) {
        keys.push(Buffer.from(rawBytes.slice(cursor, cursor + 32)));
        cursor += 32;
      }

      const blockhash = Buffer.from(rawBytes.slice(cursor, cursor + 32));
      cursor += 32;

      const { length: ixCount, size: ixLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += ixLenSize;

      type ParsedIx = {
        programIdIndex: number;
        accounts: number[];
        data: Buffer;
      };
      const allIxs: ParsedIx[] = [];
      for (let i = 0; i < ixCount; i++) {
        const programIdIndex = rawBytes[cursor]!;
        cursor += 1;
        const { length: aLen, size: aLenSize } = this.decodeCompactU16(
          rawBytes,
          cursor,
        );
        cursor += aLenSize;
        const accounts: number[] = [];
        for (let j = 0; j < aLen; j++) {
          accounts.push(rawBytes[cursor]!);
          cursor += 1;
        }
        const { length: dLen, size: dLenSize } = this.decodeCompactU16(
          rawBytes,
          cursor,
        );
        cursor += dLenSize;
        const data = Buffer.from(rawBytes.slice(cursor, cursor + dLen));
        cursor += dLen;
        allIxs.push({ programIdIndex, accounts, data });
      }

      // --- Find the primary instruction from the target or companion programs ---
      const accepted = new Set([
        targetProgramId,
        ...(COMPANION_PROGRAMS[targetProgramId] ?? []),
      ]);

      let primaryIx: ParsedIx | null = null;
      for (const ix of allIxs) {
        if (ix.programIdIndex >= keys.length) continue;
        const pid = this.toBase58(keys[ix.programIdIndex]!);
        if (!accepted.has(pid)) continue;
        const prefixes = PRIMARY_CLEAR_SIGNABLE_INSTRUCTIONS.get(pid);
        if (prefixes?.some((p) => ix.data.toString("hex").startsWith(p))) {
          primaryIx = ix;
          break;
        }
      }
      if (!primaryIx) return null;

      // --- Determine key properties from original header ---
      const origIsWritable = (i: number) =>
        i < numReqSig - numRoSig ||
        (i >= numReqSig && i < keyCount - numRoUnsig);

      // --- Collect referenced keys (payer + instruction accounts + program) ---
      const refSet = new Set<number>([0]); // always include payer
      refSet.add(primaryIx.programIdIndex);
      for (const a of primaryIx.accounts) refSet.add(a);

      // For any signer accounts in the instruction that aren't the payer,
      // remap them to the payer index.  This produces a single-signer
      // transaction (matching fixture format) where the device key acts
      // as every authority.  Valid for testing: we only care that the
      // Ledger app can parse and display the instruction.
      const signerRemapToPayer = new Map<number, number>();
      for (const a of primaryIx.accounts) {
        if (a !== 0 && a < numReqSig) {
          signerRemapToPayer.set(a, 0);
          refSet.delete(a);
        }
      }

      type KeyEntry = {
        origIdx: number;
        key: Buffer;
        signer: boolean;
        writable: boolean;
      };

      const entries: KeyEntry[] = [];
      for (const idx of refSet) {
        if (idx >= keys.length) return null;
        entries.push({
          origIdx: idx,
          key: keys[idx]!,
          signer: idx === 0,
          writable: origIsWritable(idx) || idx === 0,
        });
      }

      // --- Sort into legacy order ---
      const wSig = entries
        .filter((e) => e.signer && e.writable)
        .sort((a, b) => (a.origIdx === 0 ? -1 : b.origIdx === 0 ? 1 : 0));
      const rSig = entries.filter((e) => e.signer && !e.writable);
      const wNon = entries.filter((e) => !e.signer && e.writable);
      const rNon = entries.filter((e) => !e.signer && !e.writable);

      const ordered = [...wSig, ...rSig, ...wNon, ...rNon];

      // --- Build index remapping ---
      const remap = new Map<number, number>();
      for (let i = 0; i < ordered.length; i++) {
        remap.set(ordered[i]!.origIdx, i);
      }

      const newProgIdx = remap.get(primaryIx.programIdIndex);
      if (newProgIdx === undefined) return null;
      const newAccts = primaryIx.accounts.map((a) => {
        const remapped = signerRemapToPayer.get(a);
        const effective = remapped !== undefined ? remapped : a;
        return remap.get(effective);
      });
      if (newAccts.some((a) => a === undefined)) return null;

      // --- Serialise as a raw legacy MESSAGE (no signature section) ---
      // The Ledger Solana app and the TransactionCrafterService both
      // accept raw messages.  Fixtures also use this format.
      const newNRS = wSig.length + rSig.length;
      const newNRoS = rSig.length;
      const newNRoU = rNon.length;
      const totalKeys = ordered.length;

      let size = 0;
      size += 3; // header
      size += this.encodeCompactU16(totalKeys).length;
      size += totalKeys * 32;
      size += 32; // blockhash
      size += this.encodeCompactU16(1).length; // 1 instruction
      size += 1; // programIdIndex
      size += this.encodeCompactU16(newAccts.length).length;
      size += newAccts.length;
      size += this.encodeCompactU16(primaryIx.data.length).length;
      size += primaryIx.data.length;

      const out = Buffer.alloc(size);
      let o = 0;

      out[o++] = newNRS;
      out[o++] = newNRoS;
      out[o++] = newNRoU;

      o += this.writeCompactU16(out, o, totalKeys);
      for (const e of ordered) {
        e.key.copy(out, o);
        o += 32;
      }
      blockhash.copy(out, o);
      o += 32;

      o += this.writeCompactU16(out, o, 1); // 1 instruction
      out[o++] = newProgIdx;
      o += this.writeCompactU16(out, o, newAccts.length);
      for (const a of newAccts) out[o++] = a!;
      o += this.writeCompactU16(out, o, primaryIx.data.length);
      primaryIx.data.copy(out, o);
      o += primaryIx.data.length;

      const primaryPid = this.toBase58(keys[primaryIx.programIdIndex]!);
      const ixAccountKeys = primaryIx.accounts.map((a) => {
        const remapped = signerRemapToPayer.get(a);
        const effective = remapped !== undefined ? remapped : a;
        return this.toBase58(keys[effective]!);
      });
      this.logger.info(
        `Distilled tx: ${ixCount}→1 instructions, ${keyCount}→${totalKeys} keys, ` +
          `header=[${newNRS},${newNRoS},${newNRoU}], ` +
          `program=${PROGRAM_LABELS[primaryPid] ?? primaryPid}, ` +
          `disc=0x${primaryIx.data.toString("hex").slice(0, 4)}, ${o} bytes`,
      );
      return {
        buffer: out.slice(0, o),
        programId: primaryPid,
        dataHex: primaryIx.data.toString("hex"),
        accountKeys: ixAccountKeys,
      };
    } catch (error) {
      this.logger.debug("Distillation failed", { data: { error } });
      return null;
    }
  }

  // --- v0 → legacy conversion ---

  private isVersionedTransaction(rawBytes: Buffer): boolean {
    try {
      let cursor = 0;
      const { length: sigCount, size: sigLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += sigLenSize + sigCount * 64;
      const firstByte = rawBytes[cursor];
      return firstByte !== undefined && (firstByte & 0x80) !== 0;
    } catch {
      return false;
    }
  }

  /**
   * Convert a v0 (versioned) transaction to legacy format by inlining
   * Address Lookup Table entries as static account keys.
   *
   * This is necessary because the Ledger Solana app does not support
   * v0 message parsing; it only recognises legacy messages.
   *
   * @param rawBytes  Original v0 transaction bytes
   * @param loadedAddresses  Resolved ALT keys from the RPC `meta.loadedAddresses`
   * @returns Legacy transaction bytes, or null on failure
   */
  private convertV0ToLegacy(
    rawBytes: Buffer,
    loadedAddresses: { writable: string[]; readonly: string[] },
  ): Buffer | null {
    try {
      let cursor = 0;

      // --- Parse signature section ---
      const { length: sigCount, size: sigLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += sigLenSize + sigCount * 64;

      // --- Verify v0 ---
      const versionByte = rawBytes[cursor]!;
      if ((versionByte & 0x80) === 0) return null;
      cursor += 1;

      // --- Parse message header ---
      const numRequiredSignatures = rawBytes[cursor]!;
      const numReadonlySigned = rawBytes[cursor + 1]!;
      const numReadonlyUnsigned = rawBytes[cursor + 2]!;
      cursor += 3;

      // --- Parse static account keys ---
      const { length: staticCount, size: staticLenSize } =
        this.decodeCompactU16(rawBytes, cursor);
      cursor += staticLenSize;

      const staticKeys: Buffer[] = [];
      for (let i = 0; i < staticCount; i++) {
        staticKeys.push(Buffer.from(rawBytes.slice(cursor, cursor + 32)));
        cursor += 32;
      }

      // --- Recent blockhash ---
      const recentBlockhash = Buffer.from(rawBytes.slice(cursor, cursor + 32));
      cursor += 32;

      // --- Parse instructions ---
      const { length: ixCount, size: ixLenSize } = this.decodeCompactU16(
        rawBytes,
        cursor,
      );
      cursor += ixLenSize;

      const instructions: {
        programIdIndex: number;
        accounts: number[];
        data: Buffer;
      }[] = [];

      for (let i = 0; i < ixCount; i++) {
        const programIdIndex = rawBytes[cursor]!;
        cursor += 1;

        const { length: acctLen, size: acctLenSize } = this.decodeCompactU16(
          rawBytes,
          cursor,
        );
        cursor += acctLenSize;
        const accounts: number[] = [];
        for (let j = 0; j < acctLen; j++) {
          accounts.push(rawBytes[cursor]!);
          cursor += 1;
        }

        const { length: dataLen, size: dataLenSize } = this.decodeCompactU16(
          rawBytes,
          cursor,
        );
        cursor += dataLenSize;
        const data = Buffer.from(rawBytes.slice(cursor, cursor + dataLen));
        cursor += dataLen;

        instructions.push({ programIdIndex, accounts, data });
      }

      // --- Decode ALT keys ---
      const altWritable = loadedAddresses.writable.map((a) =>
        this.fromBase58(a),
      );
      const altReadonly = loadedAddresses.readonly.map((a) =>
        this.fromBase58(a),
      );
      const S = staticCount;
      const W = altWritable.length;
      const R = altReadonly.length;
      const nRoU = numReadonlyUnsigned;

      // --- Build legacy key list ---
      // v0 combined order: [static] ++ [ALT writable] ++ [ALT readonly]
      // legacy order:      [writable signers] [readonly signers]
      //                    [writable non-signers (static + ALT)] [readonly non-signers (static + ALT)]
      //
      // Static keys are already ordered:
      //   [0 .. S-nRoU-1] = signers + writable non-signers
      //   [S-nRoU .. S-1]  = readonly non-signers
      //
      // We insert ALT writable before the static readonly block
      // and append ALT readonly after it.
      const newKeys: Buffer[] = [];
      for (let i = 0; i < S - nRoU; i++) newKeys.push(staticKeys[i]!);
      for (const k of altWritable) newKeys.push(k);
      for (let i = S - nRoU; i < S; i++) newKeys.push(staticKeys[i]!);
      for (const k of altReadonly) newKeys.push(k);

      // --- Index remapping ---
      const remap = (oldIdx: number): number => {
        if (oldIdx < S - nRoU) return oldIdx; // signers + static writable non-signers
        if (oldIdx < S) return oldIdx + W; // static readonly non-signers shift right
        if (oldIdx < S + W) return oldIdx - nRoU; // ALT writable shift left
        return oldIdx; // ALT readonly unchanged
      };

      const remappedIxs = instructions.map((ix) => ({
        programIdIndex: remap(ix.programIdIndex),
        accounts: ix.accounts.map(remap),
        data: ix.data,
      }));

      // --- Serialise legacy transaction ---
      const newRoUnsigned = nRoU + R;
      const totalKeys = S + W + R;

      // Estimate output size
      let size = 0;
      size += this.encodeCompactU16(numRequiredSignatures).length;
      size += numRequiredSignatures * 64; // zeroed signatures
      size += 3; // header
      size += this.encodeCompactU16(totalKeys).length;
      size += totalKeys * 32;
      size += 32; // blockhash
      size += this.encodeCompactU16(ixCount).length;
      for (const ix of remappedIxs) {
        size += 1; // programIdIndex
        size += this.encodeCompactU16(ix.accounts.length).length;
        size += ix.accounts.length;
        size += this.encodeCompactU16(ix.data.length).length;
        size += ix.data.length;
      }

      const out = Buffer.alloc(size);
      let o = 0;

      // Signature section
      o += this.writeCompactU16(out, o, numRequiredSignatures);
      o += numRequiredSignatures * 64; // zeros from alloc

      // Message header
      out[o++] = numRequiredSignatures;
      out[o++] = numReadonlySigned;
      out[o++] = newRoUnsigned;

      // Account keys
      o += this.writeCompactU16(out, o, totalKeys);
      for (const key of newKeys) {
        key.copy(out, o);
        o += 32;
      }

      // Recent blockhash
      recentBlockhash.copy(out, o);
      o += 32;

      // Instructions
      o += this.writeCompactU16(out, o, ixCount);
      for (const ix of remappedIxs) {
        out[o++] = ix.programIdIndex;
        o += this.writeCompactU16(out, o, ix.accounts.length);
        for (const acct of ix.accounts) out[o++] = acct;
        o += this.writeCompactU16(out, o, ix.data.length);
        ix.data.copy(out, o);
        o += ix.data.length;
      }

      this.logger.debug(
        `Converted v0→legacy: ${rawBytes.length}B → ${o}B (${S} static + ${W}W + ${R}R ALT keys)`,
      );
      return out.slice(0, o);
    } catch (error) {
      this.logger.debug("v0→legacy conversion failed", { data: { error } });
      return null;
    }
  }

  // --- RPC helpers ---

  private async getSignaturesForAddress(
    address: string,
    limit: number,
  ): Promise<SignatureInfo[]> {
    const response = await this.rpcCall<SignatureInfo[]>(
      "getSignaturesForAddress",
      [address, { limit, commitment: "finalized" }],
    );
    return response;
  }

  private async getTransaction(
    signature: string,
  ): Promise<RpcTransactionResult | null> {
    const response = await this.rpcCall<RpcTransactionResult | null>(
      "getTransaction",
      [
        signature,
        {
          encoding: "base64",
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        },
      ],
    );
    return response;
  }

  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const response = await axios.post<RpcResponse<T>>(
      this.rpcConfig.url,
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
      { timeout: this.rpcConfig.timeout ?? 30000 },
    );

    if (response.data.error) {
      throw new Error(
        `Solana RPC error: ${response.data.error.message} (code ${response.data.error.code})`,
      );
    }

    return response.data.result;
  }

  // --- Encoding helpers ---

  private decodeCompactU16(
    bytes: Buffer,
    offset: number,
  ): { length: number; size: number } {
    let value = 0;
    let size = 0;
    let shift = 0;

    while (true) {
      const byte = bytes[offset + size];
      if (byte === undefined) throw new Error("compact-u16 decode overflow");
      value |= (byte & 0x7f) << shift;
      size += 1;
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift >= 21) throw new Error("compact-u16 too long");
    }
    return { length: value, size };
  }

  private encodeCompactU16(value: number): Buffer {
    const bytes: number[] = [];
    let remaining = value;
    if (remaining === 0) return Buffer.from([0]);
    while (remaining > 0x7f) {
      bytes.push((remaining & 0x7f) | 0x80);
      remaining >>= 7;
    }
    bytes.push(remaining);
    return Buffer.from(bytes);
  }

  private writeCompactU16(buf: Buffer, offset: number, value: number): number {
    const encoded = this.encodeCompactU16(value);
    encoded.copy(buf, offset);
    return encoded.length;
  }

  private static readonly BASE58_ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  private toBase58(bytes: Uint8Array | Buffer): string {
    const ALPHABET = HttpSolanaRpcAdapter.BASE58_ALPHABET;
    const digits = [0];

    for (const byte of bytes) {
      let carry = byte;
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j]! * 256;
        digits[j] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = Math.floor(carry / 58);
      }
    }

    let result = "";
    for (const byte of bytes) {
      if (byte === 0) {
        result += ALPHABET[0];
      } else {
        break;
      }
    }

    // Strip trailing zero-value digits (they represent the value 0
    // which is already covered by leading-zero '1' chars above).
    let end = digits.length - 1;
    while (end > 0 && digits[end] === 0) end--;

    for (let i = end; i >= 0; i--) {
      // Don't emit a '1' for the sole remaining zero digit when the
      // entire input was zero bytes — those are already in `result`.
      if (i === 0 && digits[0] === 0 && result.length > 0) break;
      result += ALPHABET[digits[i]!];
    }

    return result;
  }

  private fromBase58(str: string): Buffer {
    const ALPHABET = HttpSolanaRpcAdapter.BASE58_ALPHABET;
    const bytes = [0];

    for (const char of str) {
      let carry = ALPHABET.indexOf(char);
      if (carry < 0) throw new Error(`Invalid base58 character: ${char}`);
      for (let j = 0; j < bytes.length; j++) {
        carry += bytes[j]! * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }

    let leadingZeros = 0;
    for (const char of str) {
      if (char === "1") leadingZeros++;
      else break;
    }

    const result = Buffer.alloc(leadingZeros + bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      result[leadingZeros + i] = bytes[bytes.length - 1 - i]!;
    }
    return result;
  }
}
