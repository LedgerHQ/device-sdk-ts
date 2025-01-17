import { CommandResultFactory } from "@ledgerhq/device-management-kit";

import { ExtractTransactionTask } from "@internal/app-binder/task/ExtractTransactionTask";
import { Key } from "@internal/psbt/model/Key";
import { Psbt, PsbtGlobal, PsbtIn, PsbtOut } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
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
            new Value(Uint8Array.of(0x10)),
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
        data: "0x000000000001010800000000029398000000000100000000000000000109203009080706",
      }),
    );
  });
});
