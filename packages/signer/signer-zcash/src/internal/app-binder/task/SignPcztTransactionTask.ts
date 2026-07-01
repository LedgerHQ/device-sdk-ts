import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  type OrchardActionSignature,
  type SignPcztTransactionResult,
} from "@api/model/PcztSignature";
import {
  type PcztOrchardBundle,
  type PcztTransaction,
} from "@api/model/PcztTransaction";
import { PcztHeaderCommand } from "@internal/app-binder/command/PcztHeaderCommand";
import { PcztOrchardActionCommand } from "@internal/app-binder/command/PcztOrchardActionCommand";
import { PcztTransparentInputCommand } from "@internal/app-binder/command/PcztTransparentInputCommand";
import { PcztTransparentOutputCommand } from "@internal/app-binder/command/PcztTransparentOutputCommand";
import { SignPcztOrchardCommand } from "@internal/app-binder/command/SignPcztOrchardCommand";
import { SignPcztTransparentCommand } from "@internal/app-binder/command/SignPcztTransparentCommand";
import { PCZT_P2 } from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  pcztP1,
  pcztP2,
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

/**
 * Drives the device PCZT Orchard signing protocol end-to-end:
 *
 * 1. streams the PCZT bundle in the fixed order — `PCZT_HEADER`,
 *    `PCZT_TRANSPARENT_INPUT`, `PCZT_TRANSPARENT_OUTPUT`, `PCZT_ORCHARD_ACTION`
 *    (every section always sent; count `0` when empty), the last Orchard packet
 *    carrying `PCZT_P2.FINISHED` to finalize the payload;
 * 2. collects one `spendAuthSig[64]` per Orchard action (`PCZT_SIGN_ORCHARD`);
 * 3. collects one secp256k1 signature per transparent input
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
    const { global, transparentInputs, transparentOutputs, orchardBundle } =
      this.args.transaction;
    const bundle = orchardBundle ?? EMPTY_ORCHARD_BUNDLE;

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
          // `finished: true` here is correct for every flow, including the
          // transparent-only one where the Orchard section is a single count-0
          // packet: `pcztP2` only sets `FINISHED` on the *last* Orchard packet,
          // and `ORCHARD_ACTION` is always the final bundle command, so the
          // marker lands exactly where the device expects it. The device
          // accepts signing commands only after seeing `FINISHED`
          // (`app-zcash` `src/handlers/pczt.rs::finish_pczt_if_requested`).
          p2: pcztP2(i, orchardPackets.length, true),
        }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
    }

    // 2. Collect one spendAuthSig per Orchard action.
    const orchard: OrchardActionSignature[] = [];
    for (let i = 0; i < bundle.actions.length; i += 1) {
      const result = await this.api.sendCommand(
        new SignPcztOrchardCommand({ actionIndex: i }),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
      orchard.push(result.data);
    }

    // 3. Collect one signature per transparent input.
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

    return DmkResultFactory({ data: { orchard, transparentInputSigs } });
  }
}
