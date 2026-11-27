import {
  bufferToHexaString,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "bitcoinjs-lib";

import { ExtractTransactionTask } from "@internal/app-binder/task/ExtractTransactionTask";
import { Key } from "@internal/psbt/model/Key";
import { Psbt, PsbtGlobal, PsbtIn, PsbtOut } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { DefaultPsbtV2Normalizer } from "@internal/psbt/service/psbt/DefaultPsbtV2Normalizer";
import { DefaultValueFactory } from "@internal/psbt/service/value/DefaultValueFactory";
import { DefaultValueParser } from "@internal/psbt/service/value/DefaultValueParser";

describe("ExtractTransactionTask", () => {
  it("should extract transaction from a signed psbt", () => {
    // given
    const psbt = new Psbt(
      new Map([
        [
          new Key(PsbtGlobal.VERSION).toHexaString(),
          new Value(Uint8Array.from([0x02])),
        ],
        [
          new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
          new Value(Uint8Array.from([0x01])),
        ],
        [
          new Key(PsbtGlobal.OUTPUT_COUNT).toHexaString(),
          new Value(Uint8Array.from([0x01])),
        ],
        [
          new Key(PsbtGlobal.FALLBACK_LOCKTIME).toHexaString(),
          new Value(Uint8Array.from([0x09, 0x08, 0x07, 0x06, 0x05, 0x04])),
        ],
      ]),
      [
        new Map([
          [
            new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
            new Value(Uint8Array.from([0x01, 0x02, 0x03, 0x04])),
          ],
          [
            new Key(PsbtIn.PREVIOUS_TXID).toHexaString(),
            new Value(Uint8Array.from([0x08])),
          ],
          [
            new Key(PsbtIn.OUTPUT_INDEX).toHexaString(),
            new Value(Uint8Array.from([0x62])),
          ],
          [
            new Key(PsbtIn.FINAL_SCRIPTSIG).toHexaString(),
            new Value(Uint8Array.from([0x93, 0x98])),
          ],
          [
            new Key(PsbtIn.SEQUENCE).toHexaString(),
            new Value(Uint8Array.of(0x10, 0x00, 0x00, 0x00)),
          ],
          [
            new Key(PsbtIn.FINAL_SCRIPTWITNESS).toHexaString(),
            new Value(Uint8Array.of(0x20, 0x30)),
          ],
        ]),
      ],
      [
        new Map([
          [
            new Key(PsbtOut.AMOUNT).toHexaString(),
            new Value(Uint8Array.from([0x32])),
          ],
          [
            new Key(PsbtOut.SCRIPT).toHexaString(),
            new Value(Uint8Array.of(0x09)),
          ],
        ]),
      ],
    );
    // when
    const tx = new ExtractTransactionTask(
      { psbt },
      new DefaultValueParser(),
    ).run();
    // then
    expect(tx).toStrictEqual(
      CommandResultFactory({
        data: "0x000000000001010800000000029398100000000100000000000000000109203009080706",
      }),
    );
  });

  describe("with a PSBTv0 normalized to PSBTv2", () => {
    const SCRIPT_SIG = Buffer.from([0x51, 0x52]);

    const buildTransaction = (version: number, sequence: number) => {
      const tx = new Transaction();
      tx.version = version;
      tx.locktime = 850000;
      tx.addInput(Buffer.alloc(32, 0xab), 1, sequence);
      tx.addOutput(
        Buffer.concat([Buffer.from([0x00, 0x14]), Buffer.alloc(20)]),
        1500,
      );
      return tx;
    };

    // A PSBTv0 holding the unsigned transaction, normalized as signTransaction
    // does, with a final scriptSig on its input
    const normalizedPsbt = (tx: Transaction) => {
      const psbt = new Psbt(
        new Map([
          [
            new Key(PsbtGlobal.UNSIGNED_TX).toHexaString(),
            new Value(tx.toBuffer()),
          ],
        ]),
        [new Map()],
        [new Map()],
      );
      const normalized = new DefaultPsbtV2Normalizer(
        new DefaultValueParser(),
        new DefaultValueFactory(),
      )
        .normalize(psbt)
        .unsafeCoerce();
      normalized.setInputValue(
        0,
        PsbtIn.FINAL_SCRIPTSIG,
        new Value(SCRIPT_SIG),
      );
      return normalized;
    };

    const signed = (tx: Transaction) => {
      const copy = tx.clone();
      copy.ins[0]!.script = SCRIPT_SIG;
      return bufferToHexaString(copy.toBuffer());
    };

    it.each([1, 2, 3])("should keep the transaction version %i", (version) => {
      const tx = buildTransaction(version, 0xfffffffd);

      const result = new ExtractTransactionTask(
        { psbt: normalizedPsbt(tx) },
        new DefaultValueParser(),
      ).run();

      expect(result).toStrictEqual(CommandResultFactory({ data: signed(tx) }));
    });

    it("should use sequence 0xffffffff for an input without PSBT_IN_SEQUENCE", () => {
      const tx = buildTransaction(2, 0xffffffff);
      const psbt = normalizedPsbt(tx);
      psbt.inputMaps[0]!.delete(new Key(PsbtIn.SEQUENCE).toHexaString());

      const result = new ExtractTransactionTask(
        { psbt },
        new DefaultValueParser(),
      ).run();

      expect(result).toStrictEqual(CommandResultFactory({ data: signed(tx) }));
    });
  });
});
