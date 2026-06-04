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

  build(): DescriptorRequirements {
    return {
      instructionInfos: this.instructionInfos.values(),
      enumVariants: this.enumVariants.values(),
      tokenInfos: this.tokenInfos.values(),
      tokenAccountStates: this.tokenAccountStates.values(),
      altResolutions: this.altResolutions.values(),
      trustedNames: this.trustedNames.values(),
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
