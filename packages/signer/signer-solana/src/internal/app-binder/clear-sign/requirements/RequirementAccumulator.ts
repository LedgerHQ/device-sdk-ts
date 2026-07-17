import {
  type AltEntryKey,
  type DescriptorRequirements,
  type EnumVariantKey,
  type ProgramDiscriminator,
} from "./model";

/**
 * Collects requirements while deduplicating by each descriptor's key and
 * preserving first-seen order, so the output is deterministic.
 */
export class RequirementAccumulator {
  private readonly instructionInfos = new OrderedSet<ProgramDiscriminator>();
  private readonly enumVariants = new OrderedSet<EnumVariantKey>();
  private readonly tokenInfos = new OrderedSet<string>();
  private readonly tokenAccountStates = new OrderedSet<string>();
  private readonly altResolutions = new OrderedSet<AltEntryKey>();
  private readonly trustedNames = new OrderedSet<string>();
  private readonly tokenAmountRefs = new OrderedSet<string>();
  private readonly tokenAmountAltRefs = new OrderedSet<AltEntryKey>();
  private readonly mintAltRefs = new OrderedSet<AltEntryKey>();

  addInstructionInfo(programId: string, discriminator: string): void {
    this.instructionInfos.add(`${programId}:${discriminator}`, {
      programId,
      discriminator,
    });
  }

  addEnumVariant(
    programId: string,
    enumId: string,
    variantIndex: number,
  ): void {
    this.enumVariants.add(`${programId}:${enumId}:${variantIndex}`, {
      programId,
      enumId,
      variantIndex,
    });
  }

  addTokenInfo(mint: string): void {
    this.tokenInfos.add(mint, mint);
  }

  addTokenAccountState(account: string): void {
    this.tokenAccountStates.add(account, account);
  }

  addAltResolution(altAddress: string, entryIndex: number): void {
    this.altResolutions.add(`${altAddress}:${entryIndex}`, {
      altAddress,
      entryIndex,
    });
  }

  addTrustedName(address: string): void {
    this.trustedNames.add(address, address);
  }

  addTokenAmountRef(address: string): void {
    this.tokenAmountRefs.add(address, address);
  }

  addTokenAmountAltRef(altAddress: string, entryIndex: number): void {
    this.tokenAmountAltRefs.add(`${altAddress}:${entryIndex}`, {
      altAddress,
      entryIndex,
    });
  }

  addMintAltRef(altAddress: string, entryIndex: number): void {
    this.mintAltRefs.add(`${altAddress}:${entryIndex}`, {
      altAddress,
      entryIndex,
    });
  }

  build(): DescriptorRequirements {
    // Priority across the three ALT loops: tokenAmountAltRefs > mintAltRefs >
    // altResolutions. Each higher-priority bucket does everything the lower one
    // does plus more (TOKEN_INFO / TOKEN_ACCOUNT_STATE fallback). Strip
    // lower-priority entries here so the provide phase never sees duplicates and
    // always runs the most complete behaviour for each (altAddress, entryIndex).
    const altKey = ({ altAddress, entryIndex }: AltEntryKey) =>
      `${altAddress}:${entryIndex}`;
    const tokenAmountKeys = new Set(
      this.tokenAmountAltRefs.values().map(altKey),
    );
    const mintKeys = new Set(this.mintAltRefs.values().map(altKey));

    return {
      instructionInfos: this.instructionInfos.values(),
      enumVariants: this.enumVariants.values(),
      tokenInfos: this.tokenInfos.values(),
      tokenAccountStates: this.tokenAccountStates.values(),
      altResolutions: this.altResolutions
        .values()
        .filter(
          (k) => !mintKeys.has(altKey(k)) && !tokenAmountKeys.has(altKey(k)),
        ),
      trustedNames: this.trustedNames.values(),
      tokenAmountRefs: this.tokenAmountRefs.values(),
      tokenAmountAltRefs: this.tokenAmountAltRefs.values(),
      mintAltRefs: this.mintAltRefs
        .values()
        .filter((k) => !tokenAmountKeys.has(altKey(k))),
    };
  }
}

class OrderedSet<T> {
  private readonly seen = new Set<string>();
  private readonly items: T[] = [];

  add(key: string, item: T): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.items.push(item);
  }

  values(): T[] {
    return [...this.items];
  }
}
