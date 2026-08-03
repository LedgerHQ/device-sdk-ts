import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  InvalidArgumentError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  type IronwoodActionSignature,
  type OrchardActionSignature,
  type SignPcztTransactionResult,
} from "@api/model/PcztSignature";
import {
  type PcztOrchardBundle,
  type PcztTransaction,
} from "@api/model/PcztTransaction";
import { PcztHeaderCommand } from "@internal/app-binder/command/PcztHeaderCommand";
import { PcztIronwoodActionCommand } from "@internal/app-binder/command/PcztIronwoodActionCommand";
import { PcztOrchardActionCommand } from "@internal/app-binder/command/PcztOrchardActionCommand";
import { PcztTransparentInputCommand } from "@internal/app-binder/command/PcztTransparentInputCommand";
import { PcztTransparentOutputCommand } from "@internal/app-binder/command/PcztTransparentOutputCommand";
import { SignPcztIronwoodCommand } from "@internal/app-binder/command/SignPcztIronwoodCommand";
import { SignPcztOrchardCommand } from "@internal/app-binder/command/SignPcztOrchardCommand";
import { SignPcztTransparentCommand } from "@internal/app-binder/command/SignPcztTransparentCommand";
import { PCZT_P2 } from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  pcztP1,
  pcztP2,
  serializeIronwoodActions,
  serializeOrchardActions,
  serializePcztHeader,
  serializeTransparentInputs,
  serializeTransparentOutputs,
} from "@internal/app-binder/command/utils/pcztSerializer";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

export type SignPcztTransactionTaskArgs = {
  transaction: PcztTransaction;
};

type SignPcztTransactionTaskError =
  CommandErrorResult<ZcashErrorCodes>["error"];

export type SignPcztTransactionTaskResult = DmkResult<
  SignPcztTransactionResult,
  SignPcztTransactionTaskError
>;

const EMPTY_ORCHARD_BUNDLE: PcztOrchardBundle = {
  actions: [],
  flags: 0,
  valueBalance: 0n,
  anchor: new Uint8Array(32),
};

/** Transaction version that introduces Ironwood bundles (NU6.3). */
const V6_TX_VERSION = 6;

/**
 * Drives the device PCZT signing protocol end-to-end, supporting both V5
 * (Orchard) and V6 (Orchard + Ironwood) transactions:
 *
 * 1. streams the PCZT bundle in the fixed order — `PCZT_HEADER`,
 *    `PCZT_TRANSPARENT_INPUT`, `PCZT_TRANSPARENT_OUTPUT`, `PCZT_ORCHARD_ACTION`,
 *    and for V6: `PCZT_IRONWOOD_ACTION` (a null Ironwood bundle on a V6
 *    transaction is rejected as invalid input before any APDU is sent). For
 *    V5, the last Orchard packet carries `PCZT_P2.FINISHED`; for V6, the last
 *    Ironwood packet carries `PCZT_P2.FINISHED`;
 * 2. collects one `spendAuthSig[64]` per Orchard action (`PCZT_SIGN_ORCHARD`);
 * 3. collects one `spendAuthSig[64]` per Ironwood action for V6
 *    (`PCZT_SIGN_IRONWOOD`);
 * 4. collects one secp256k1 signature per transparent input
 *    (`PCZT_SIGN_TRANSPARENT`).
 *
 * It never sends `bsk` nor collects `bindingSig` — the binding signature is a
 * host-side concern (zcash-utils). Supports all four transfer flows; they
 * differ only in which bundle sections are non-empty.
 */
export class SignPcztTransactionTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SignPcztTransactionTaskArgs,
  ) {}

  async run(): Promise<SignPcztTransactionTaskResult> {
    const {
      global,
      transparentInputs,
      transparentOutputs,
      orchardBundle,
      ironwoodBundle: ironwoodBundleInput,
    } = this.args.transaction;
    const bundle = orchardBundle ?? EMPTY_ORCHARD_BUNDLE;
    const ironwoodBundle = ironwoodBundleInput ?? null;

    // V6 transactions have an Ironwood bundle; PCZT_P2.FINISHED moves to the
    // last Ironwood packet instead of the last Orchard packet.
    const isV6 = global.txVersion === V6_TX_VERSION;

    if (isV6 && ironwoodBundle === null) {
      return DmkResultFactory({
        error: new InvalidArgumentError(
          "V6 transaction requires a non-null Ironwood bundle",
        ),
      });
    }

    if (!isV6 && ironwoodBundle !== null) {
      return DmkResultFactory({
        error: new InvalidArgumentError(
          "V5 transaction does not support an Ironwood bundle",
        ),
      });
    }

    const hasIronwood = isV6 && ironwoodBundle !== null;

    // 1. Stream the PCZT bundle, in order.
    const headerResult = await this.api.sendCommand(
      new PcztHeaderCommand({ data: serializePcztHeader(global) }),
    );
    if (!isSuccessCommandResult(headerResult)) {
      return DmkResultFactory({ error: headerResult.error });
    }

    const inputPackets = serializeTransparentInputs(transparentInputs);
    for (let i = 0; i < inputPackets.length; i += 1) {
      const result = await this.api.sendCommand(
        new PcztTransparentInputCommand({
          data: inputPackets[i]!,
          p1: pcztP1(i, inputPackets.length),
          p2: PCZT_P2.CONTINUE,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
    }

    const outputPackets = serializeTransparentOutputs(transparentOutputs);
    for (let i = 0; i < outputPackets.length; i += 1) {
      const result = await this.api.sendCommand(
        new PcztTransparentOutputCommand({
          data: outputPackets[i]!,
          p1: pcztP1(i, outputPackets.length),
          p2: PCZT_P2.CONTINUE,
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
    }

    const orchardPackets = serializeOrchardActions(bundle);
    for (let i = 0; i < orchardPackets.length; i += 1) {
      const result = await this.api.sendCommand(
        new PcztOrchardActionCommand({
          data: orchardPackets[i]!,
          p1: pcztP1(i, orchardPackets.length),
          // For V5 the last Orchard packet carries FINISHED; for V6 it stays
          // CONTINUE because FINISHED moves to the last Ironwood packet.
          p2: pcztP2(i, orchardPackets.length, !isV6),
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
    }

    // Stream the Ironwood bundle only for V6 transactions. V5 transactions must
    // never send INS_PCZT_IRONWOOD_ACTION — the device rejects unexpected APDUs
    // after PCZT_P2.FINISHED.
    // Note: requires firmware compiled with the `zcash_unstable` feature flag
    // (NU6.3 Ironwood support). Without it the device returns InsNotSupportedError
    // (6d00) on the first INS_PCZT_IRONWOOD_ACTION APDU, after Orchard streaming
    // has already sent P2=CONTINUE — leaving the device waiting for more data.
    if (hasIronwood) {
      const ironwoodPackets = serializeIronwoodActions(ironwoodBundle!);
      for (let i = 0; i < ironwoodPackets.length; i += 1) {
        const result = await this.api.sendCommand(
          new PcztIronwoodActionCommand({
            data: ironwoodPackets[i]!,
            p1: pcztP1(i, ironwoodPackets.length),
            p2: pcztP2(i, ironwoodPackets.length, true),
          }),
        );
        if (!isSuccessCommandResult(result)) {
          return DmkResultFactory({ error: result.error });
        }
      }
    }

    // 2. Collect one spendAuthSig per Orchard action the device must sign.
    //    Only real spends are signed on-device. Dummy padding spends
    //    (`spendValue === 0n`) are self-signed host-side by the PCZT
    //    IoFinalizer at build time, so the
    //    finalizer leaves only real spends unsigned and expects exactly one
    //    device signature per unsigned action, applied in action-index order
    //    (zcash-utils finalize.rs). Signing a dummy here would make the device
    //    signature count exceed the unsigned-action count and be rejected
    //    ("Orchard signature count N != unsigned action count M"). Skipping by
    //    index preserves that ordering: the full bundle is still streamed above,
    //    only the signing requests are restricted to real spends.
    const orchard: OrchardActionSignature[] = [];
    for (let i = 0; i < bundle.actions.length; i += 1) {
      if (bundle.actions[i]!.spendValue === 0n) {
        continue;
      }
      const result = await this.api.sendCommand(
        new SignPcztOrchardCommand({ actionIndex: i }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
      orchard.push(result.data);
    }

    // 3. Collect one spendAuthSig per Ironwood action the device must sign.
    //    Same dummy-spend skip as Orchard: spendValue === 0n means a padding
    //    spend self-signed host-side by the PCZT IoFinalizer.
    const ironwood: IronwoodActionSignature[] = [];
    if (hasIronwood) {
      for (let i = 0; i < ironwoodBundle!.actions.length; i += 1) {
        if (ironwoodBundle!.actions[i]!.spendValue === 0n) {
          continue;
        }
        const result = await this.api.sendCommand(
          new SignPcztIronwoodCommand({ actionIndex: i }),
        );
        if (!isSuccessCommandResult(result)) {
          return DmkResultFactory({ error: result.error });
        }
        ironwood.push(result.data);
      }
    }

    // 4. Collect one signature per transparent input.
    const transparentInputSigs: Uint8Array[] = [];
    for (let i = 0; i < transparentInputs.length; i += 1) {
      const result = await this.api.sendCommand(
        new SignPcztTransparentCommand({ inputIndex: i }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
      transparentInputSigs.push(result.data.signature);
    }

    return DmkResultFactory({
      data: { orchard, transparentInputSigs, ironwood },
    });
  }
}
