import {
  CommandResultFactory,
  type DeviceActionState,
  DeviceActionStatus,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { address } from "@solana/addresses";
import { blockhash as toBlockhash } from "@solana/rpc-types";
import {
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createTransactionMessage,
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/transaction-messages";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedMessage,
} from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CraftTransactionDAError,
  type CraftTransactionDAInput,
  type CraftTransactionDAIntermediateValue,
} from "@api/app-binder/CraftTransactionDeviceActionTypes";

import { CraftTransactionDeviceAction } from "./CraftTransactionDeviceAction";

// These tests drive the device action end to end with its real dependencies:
// the device action constructs the real AltResolverService and crafter itself
// (extractDependencies is not stubbed here). Legacy and no-ALT messages let the
// resolver short-circuit to an empty table list, and every case uses the
// serialisedTransaction path, so the whole flow runs without any network call.

const derivationPath = "44'/501'/0'/0'";
const blockhash = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";

const oldPayer = new PublicKey("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
const newPayer = new PublicKey("DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy");
const recipient = new PublicKey("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");
const secondSigner = new PublicKey(
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
);

let warnSpy: ReturnType<typeof vi.fn>;
let apiMock: InternalApi;

function makeInternalApi(): InternalApi {
  return {
    sendApdu: vi.fn(),
    // GetPubKeyCommand returns the new payer address as its data.
    sendCommand: vi
      .fn()
      .mockResolvedValue(CommandResultFactory({ data: newPayer.toBase58() })),
    getDeviceModel: vi.fn(),
    getDeviceSessionState: vi.fn(),
    getDeviceSessionStateObservable: vi.fn(),
    setDeviceSessionState: vi.fn(),
    getManagerApiService: vi.fn(),
    getSecureChannelService: vi.fn(),
    loggerFactory: vi.fn(
      () =>
        ({
          debug: vi.fn(),
          info: vi.fn(),
          warn: warnSpy,
          error: vi.fn(),
          subscribers: [],
        }) as unknown as LoggerPublisherService,
    ),
  } as unknown as InternalApi;
}

function legacyTransferMessage(): string {
  const message = new TransactionMessage({
    payerKey: oldPayer,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: oldPayer,
        toPubkey: recipient,
        lamports: 1_000_000,
      }),
    ],
  }).compileToLegacyMessage();
  return Buffer.from(message.serialize()).toString("base64");
}

function twoSignerMessage(): string {
  const message = new TransactionMessage({
    payerKey: oldPayer,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: oldPayer,
        toPubkey: recipient,
        lamports: 1_000_000,
      }),
      // A second signer forces numRequiredSignatures to 2.
      SystemProgram.transfer({
        fromPubkey: secondSigner,
        toPubkey: recipient,
        lamports: 2_000_000,
      }),
    ],
  }).compileToLegacyMessage();
  return Buffer.from(message.serialize()).toString("base64");
}

function makeInput(
  overrides: Partial<CraftTransactionDAInput>,
): CraftTransactionDAInput {
  return {
    derivationPath,
    skipOpenApp: true,
    ...overrides,
  };
}

type CraftState = DeviceActionState<
  string,
  CraftTransactionDAError,
  CraftTransactionDAIntermediateValue
>;

function runToCompletion(input: CraftTransactionDAInput): Promise<CraftState> {
  return new Promise((resolve, reject) => {
    const action = new CraftTransactionDeviceAction({ input });
    let last: CraftState | null = null;

    const { observable } = action._execute(apiMock);
    observable.subscribe({
      next: (state) => {
        last = state as CraftState;
      },
      error: reject,
      complete: () => {
        if (last === null) {
          reject(new Error("device action completed without emitting state"));
          return;
        }
        resolve(last);
      },
    });
  });
}

function craftedStaticKeys(output: string): string[] {
  const message = VersionedMessage.deserialize(
    new Uint8Array(Buffer.from(output, "base64")),
  );
  return message.staticAccountKeys.map((key) => key.toBase58());
}

// v1 (SIMD-0385) fixtures, built with @solana/transaction-messages since
// @solana/web3.js has no v1 support at all.
const v1RecentBlockhash = toBlockhash(blockhash);
const v1OldPayer = address(oldPayer.toBase58());
const v1Recipient = address(recipient.toBase58());
const systemProgram = address("11111111111111111111111111111111");

function v1TransferMessage(): string {
  const withFeePayer = setTransactionMessageFeePayer(
    v1OldPayer,
    createTransactionMessage({ version: 1 }),
  );
  const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
    { blockhash: v1RecentBlockhash, lastValidBlockHeight: 1000n },
    withFeePayer,
  );
  const withInstructions = appendTransactionMessageInstructions(
    [
      {
        programAddress: systemProgram,
        accounts: [{ address: v1Recipient, role: 1 }],
        data: new Uint8Array([2, 0, 0, 0, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0]),
      },
    ],
    withLifetime,
  );
  const bytes = getCompiledTransactionMessageEncoder().encode(
    compileTransactionMessage(withInstructions),
  );
  return Buffer.from(bytes).toString("base64");
}

function craftedV1FeePayer(output: string): string {
  const bytes = new Uint8Array(Buffer.from(output, "base64"));
  const message = decompileTransactionMessage(
    getCompiledTransactionMessageDecoder().decode(bytes),
  );
  return (message as { feePayer: { address: string } }).feePayer.address;
}

describe("CraftTransactionDeviceAction integration (real resolver + crafter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.fn();
    apiMock = makeInternalApi();
  });

  it("auto-detect mode: re-points the payer of a legacy transfer end to end", async () => {
    const input = makeInput({ serialisedTransaction: legacyTransferMessage() });

    const finalState = await runToCompletion(input);

    expect(finalState.status).toBe(DeviceActionStatus.Completed);
    const output = (finalState as { output: string }).output;
    const keys = craftedStaticKeys(output);
    expect(keys).toContain(newPayer.toBase58());
    expect(keys).not.toContain(oldPayer.toBase58());
  });

  it("explicit-map mode: re-points an account passed in the replacements map", async () => {
    const input = makeInput({
      serialisedTransaction: legacyTransferMessage(),
      // Override the auto-detected recipient with an explicit pair.
      replacements: { [recipient.toBase58()]: secondSigner.toBase58() },
    });

    const finalState = await runToCompletion(input);

    expect(finalState.status).toBe(DeviceActionStatus.Completed);
    const output = (finalState as { output: string }).output;
    const keys = craftedStaticKeys(output);
    expect(keys).toContain(secondSigner.toBase58());
    expect(keys).not.toContain(recipient.toBase58());
  });

  it("warns and re-points only the payer when the source has multiple signers", async () => {
    const input = makeInput({ serialisedTransaction: twoSignerMessage() });

    const finalState = await runToCompletion(input);

    expect(finalState.status).toBe(DeviceActionStatus.Completed);
    expect(warnSpy).toHaveBeenCalledOnce();

    const output = (finalState as { output: string }).output;
    const keys = craftedStaticKeys(output);
    // The payer is swapped; the second signer is left in place since a single
    // device cannot co-sign.
    expect(keys).toContain(newPayer.toBase58());
    expect(keys).not.toContain(oldPayer.toBase58());
    expect(keys).toContain(secondSigner.toBase58());
  });

  it("v1 (SIMD-0385): re-points the payer of a v1 transfer end to end, without touching ALT resolution", async () => {
    const input = makeInput({ serialisedTransaction: v1TransferMessage() });

    const finalState = await runToCompletion(input);

    expect(finalState.status).toBe(DeviceActionStatus.Completed);
    const output = (finalState as { output: string }).output;
    expect(craftedV1FeePayer(output)).toBe(newPayer.toBase58());
  });
});
