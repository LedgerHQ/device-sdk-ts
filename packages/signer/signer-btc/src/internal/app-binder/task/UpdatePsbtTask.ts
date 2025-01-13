import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Either, EitherAsync } from "purify-ts";

import { type Psbt as ApiPsbt } from "@api/model/Psbt";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type PsbtSignature } from "@internal/app-binder/task/SignPsbtTask";
import {
  type Psbt as InternalPsbt,
  PsbtGlobal,
  PsbtIn,
} from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { encodeVarint } from "@internal/utils/Varint";

type UpdatePsbtTaskArgs = {
  psbt: ApiPsbt;
  signatures: PsbtSignature[];
};

export class UpdatePsbtTask {
  constructor(
    private readonly _args: UpdatePsbtTaskArgs,
    private readonly _valueParser: ValueParser,
    private readonly _psbtMapper: PsbtMapper,
  ) {}

  public async run(): Promise<CommandResult<InternalPsbt, BtcErrorCodes>> {
    const { psbt: apiPsbt, signatures } = this._args;
    return await EitherAsync(async ({ liftEither }) => {
      const psbt = await liftEither(this._psbtMapper.map(apiPsbt));
      const signedPsbt = await liftEither(this.getSignedPsbt(psbt, signatures));
      return liftEither(this.getUpdatedPsbt(signedPsbt));
    }).caseOf({
      Left: (error) => {
        return CommandResultFactory({
          error: new UnknownDeviceExchangeError(error),
        });
      },
      Right: (data) => CommandResultFactory({ data }),
    });
  }

  private getSignedPsbt(
    psbt: InternalPsbt,
    psbtSignatures: PsbtSignature[],
  ): Either<Error, InternalPsbt> {
    return Either.encase(() => {
      for (const psbtSignature of psbtSignatures) {
        // Note: Looking at BIP32 derivation does not work in the generic case,
        // since some inputs might not have a BIP32-derived pubkey.
        const pubkeys = psbt
          .getInputKeyDatas(psbtSignature.inputIndex, PsbtIn.BIP32_DERIVATION)
          .map((keyDatas) => {
            return keyDatas.map((kDataHex) => {
              const buf = new ByteArrayBuilder();
              return buf.addHexaStringToData(kDataHex).build();
            });
          });
        pubkeys.map((pkeys) => {
          if (pkeys.length != 1) {
            // No legacy BIP32_DERIVATION, assume we're using taproot.
            const pubkey = psbt
              .getInputKeyDatas(
                psbtSignature.inputIndex,
                PsbtIn.TAP_BIP32_DERIVATION,
              )
              .map((keyDatas) => {
                return keyDatas.map((kDataHex) => {
                  const buf = new ByteArrayBuilder();
                  return buf.addHexaStringToData(kDataHex).build();
                });
              });
            pubkey.map((pKey) => {
              if (pKey.length === 0) {
                throw new Error(
                  `Missing pubkey derivation for input ${psbtSignature.inputIndex}`,
                );
              }
              psbt.setInputValue(
                psbtSignature.inputIndex,
                PsbtIn.TAP_KEY_SIG,
                new Value(psbtSignature.signature),
              );
            });
          } else {
            psbt.setKeyDataInputValue(
              psbtSignature.inputIndex,
              PsbtIn.PARTIAL_SIG,
              psbtSignature.signature,
              new Value(psbtSignature.pubKeyAugmented),
            );
          }
        });
      }
      return psbt;
    });
  }

  private getUpdatedPsbt(fromPsbt: InternalPsbt): Either<Error, InternalPsbt> {
    return Either.encase(() => {
      let psbt = fromPsbt;
      // First check that each input has a signature
      const inputCount = psbt
        .getGlobalValue(PsbtGlobal.INPUT_COUNT)
        .mapOrDefault(
          (value) => this._valueParser.getVarint(value.data).orDefault(0),
          0,
        );
      for (let i = 0; i < inputCount; i++) {
        const legacyPubkeys = psbt
          .getInputKeyDatas(i, PsbtIn.PARTIAL_SIG)
          .mapOrDefault((keys) => {
            return keys.map((keyDataHex) => {
              const buf = new ByteArrayBuilder();
              return buf.addHexaStringToData(keyDataHex).build();
            });
          }, []);
        const taprootSig = psbt.getInputValue(i, PsbtIn.TAP_KEY_SIG);
        if (legacyPubkeys.length === 0 && taprootSig.isNothing()) {
          throw Error(`No signature for input ${i} present`);
        }
        if (legacyPubkeys.length > 0) {
          psbt = this.getLegacyUpdatedPsbtInput(psbt, i, legacyPubkeys);
        } else {
          psbt = this.getTaprootUpdatedPsbtInput(psbt, i);
        }
        this.clearUpdatedPsbtInput(psbt, i);
      }
      return psbt;
    });
  }

  private clearUpdatedPsbtInput(
    fromPsbt: InternalPsbt,
    inputIndex: number,
  ): InternalPsbt {
    const psbt = fromPsbt;
    const keyTypes = [
      PsbtIn.BIP32_DERIVATION,
      PsbtIn.PARTIAL_SIG,
      PsbtIn.TAP_BIP32_DERIVATION,
      PsbtIn.TAP_KEY_SIG,
    ];
    const witnessUtxoAvailable = psbt
      .getInputValue(inputIndex, PsbtIn.WITNESS_UTXO)
      .isJust();
    const nonWitnessUtxoAvailable = psbt
      .getInputValue(inputIndex, PsbtIn.NON_WITNESS_UTXO)
      .isJust();
    if (witnessUtxoAvailable && nonWitnessUtxoAvailable) {
      // Remove NON_WITNESS_UTXO for segwit v0 as it's only needed while signing.
      // Segwit v1 doesn't have NON_WITNESS_UTXO set.
      // See https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#cite_note-7
      keyTypes.push(PsbtIn.NON_WITNESS_UTXO);
    }
    psbt.deleteInputEntries(inputIndex, keyTypes);
    return psbt;
  }

  private getLegacyUpdatedPsbtInput(
    fromPsbt: InternalPsbt,
    inputIndex: number,
    legacyPubkeys: Uint8Array[],
  ): InternalPsbt {
    const psbt = fromPsbt;
    const taprootSig = psbt.getInputValue(inputIndex, PsbtIn.TAP_KEY_SIG);
    if (legacyPubkeys.length > 1) {
      throw Error(
        `Expected exactly one signature, got ${legacyPubkeys.length}`,
      );
    }
    if (taprootSig.isJust()) {
      throw Error("Both taproot and non-taproot signatures present.");
    }
    const isSegwitV0 = psbt
      .getInputValue(inputIndex, PsbtIn.WITNESS_UTXO)
      .isJust();

    const redeemScript = psbt.getInputValue(inputIndex, PsbtIn.REDEEM_SCRIPT);
    const isWrappedSegwit = redeemScript.isJust();
    const signature = psbt.getKeyDataInputValue(
      inputIndex,
      PsbtIn.PARTIAL_SIG,
      legacyPubkeys[0]!,
    );
    if (signature.isNothing()) {
      throw new Error("Expected partial signature for input " + inputIndex);
    }
    const sig = signature.mapOrDefault((v) => v.data, Uint8Array.from([]));
    if (isSegwitV0) {
      const buffer = new ByteArrayBuilder();
      buffer.addBufferToData(
        encodeVarint(2).mapOrDefault((v) => v, Uint8Array.from([2])),
      );
      buffer.addBufferToData(
        encodeVarint(sig.length).orDefault(Uint8Array.from([0])),
      );
      buffer.addBufferToData(sig);
      buffer.addBufferToData(
        encodeVarint(legacyPubkeys[0]!.length).orDefault(Uint8Array.from([0])),
      );
      buffer.addBufferToData(legacyPubkeys[0]!);
      psbt.setInputValue(
        inputIndex,
        PsbtIn.FINAL_SCRIPTWITNESS,
        new Value(buffer.build()),
      );
      if (isWrappedSegwit) {
        const rScript = redeemScript.mapOrDefault(
          (v) => v.data,
          Uint8Array.from([]),
        );
        if (rScript.length == 0) {
          throw new Error(
            "Expected non-empty redeemscript. Can't finalize intput " +
              inputIndex,
          );
        }
        const scriptSigBuf = new ByteArrayBuilder();

        // Push redeemScript length
        scriptSigBuf.add8BitUIntToData(rScript.length);
        scriptSigBuf.addBufferToData(rScript);
        psbt.setInputValue(
          inputIndex,
          PsbtIn.FINAL_SCRIPTSIG,
          new Value(scriptSigBuf.build()),
        );
      }
    } else {
      // Legacy input
      const scriptSig = new ByteArrayBuilder();
      writePush(scriptSig, sig);
      writePush(scriptSig, legacyPubkeys[0]!);
      psbt.setInputValue(
        inputIndex,
        PsbtIn.FINAL_SCRIPTSIG,
        new Value(scriptSig.build()),
      );
    }
    return psbt;
  }

  private getTaprootUpdatedPsbtInput(
    fromPsbt: InternalPsbt,
    inputIndex: number,
  ): InternalPsbt {
    const psbt = fromPsbt;
    // Taproot input
    const maybeSignature = psbt.getInputValue(inputIndex, PsbtIn.TAP_KEY_SIG);
    if (maybeSignature.isNothing()) {
      throw Error("No signature for taproot input " + inputIndex);
    }
    const signature = maybeSignature.mapOrDefault(
      (v) => v.data,
      Uint8Array.from([]),
    );

    if (signature.length != 64 && signature.length != 65) {
      throw Error("Unexpected length of schnorr signature.");
    }
    const witnessBufferBuilder = new ByteArrayBuilder();
    witnessBufferBuilder.addBufferToData(
      encodeVarint(1).mapOrDefault((v) => v, Uint8Array.from([1])),
    );
    witnessBufferBuilder.encodeInLVFromBuffer(signature);
    psbt.setInputValue(
      inputIndex,
      PsbtIn.FINAL_SCRIPTWITNESS,
      new Value(witnessBufferBuilder.build()),
    );
    return psbt;
  }
}

function writePush(buf: ByteArrayBuilder, data: Uint8Array) {
  if (data.length <= 75) {
    buf.add8BitUIntToData(data.length);
  } else if (data.length <= 256) {
    buf.add8BitUIntToData(76);
    buf.add8BitUIntToData(data.length);
  } else if (data.length <= 256 * 256) {
    buf.add8BitUIntToData(77);
    const b = new ByteArrayBuilder()
      .add16BitUIntToData(data.length, false)
      .build();
    buf.addBufferToData(b);
  }
  buf.addBufferToData(data);
}
