import { Just } from "purify-ts";

import { Key } from "./Key";
import { Psbt, PsbtGlobal, PsbtIn, PsbtOut } from "./Psbt";
import { Value } from "./Value";

describe("Psbt", () => {
  const TEST_PSBT = new Psbt(
    new Map([
      [
        new Key(PsbtGlobal.VERSION).toHexaString(),
        new Value(Uint8Array.of(0x01)),
      ],
      [
        new Key(PsbtGlobal.UNSIGNED_TX).toHexaString(),
        new Value(Uint8Array.of(0x02)),
      ],
    ]),
    [
      new Map([
        [
          new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
          new Value(Uint8Array.of(0x03)),
        ],
        [
          new Key(
            PsbtIn.PARTIAL_SIG,
            Uint8Array.from([0x01, 0x02]),
          ).toHexaString(),
          new Value(Uint8Array.of(0x07)),
        ],
        [
          new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
          new Value(Uint8Array.of(0x04)),
        ],
      ]),
    ],
    [
      new Map([
        [
          new Key(PsbtOut.REDEEM_SCRIPT).toHexaString(),
          new Value(Uint8Array.of(0x05)),
        ],
        [
          new Key(PsbtOut.WITNESS_SCRIPT).toHexaString(),
          new Value(Uint8Array.of(0x06)),
        ],
      ]),
    ],
  );

  it("should return the correct global value", () => {
    expect(TEST_PSBT.getGlobalValue(PsbtGlobal.VERSION).isJust()).toStrictEqual(
      true,
    );
    expect(
      TEST_PSBT.getGlobalValue(PsbtGlobal.VERSION).unsafeCoerce().data,
    ).toStrictEqual(Uint8Array.of(0x01));
  });

  it("should return the correct input value", () => {
    expect(
      TEST_PSBT.getInputValue(0, PsbtIn.NON_WITNESS_UTXO).isJust(),
    ).toStrictEqual(true);
    expect(
      TEST_PSBT.getInputValue(0, PsbtIn.NON_WITNESS_UTXO).unsafeCoerce().data,
    ).toStrictEqual(Uint8Array.of(0x04));
  });

  it("should return the correct output value", () => {
    expect(
      TEST_PSBT.getOutputValue(0, PsbtOut.WITNESS_SCRIPT).isJust(),
    ).toStrictEqual(true);
    expect(
      TEST_PSBT.getOutputValue(0, PsbtOut.WITNESS_SCRIPT).unsafeCoerce().data,
    ).toStrictEqual(Uint8Array.of(0x06));
  });

  it("should return the correct input key data", () => {
    expect(
      TEST_PSBT.getKeyDataInputValue(
        0,
        PsbtIn.PARTIAL_SIG,
        Uint8Array.from([0x01, 0x02]),
      ),
    ).toStrictEqual(Just(new Value(Uint8Array.from([0x07]))));
  });
  it("should return all key datas corresponding to a given input", () => {
    // given
    const psbt = new Psbt(new Map(), [
      new Map([
        [
          new Key(
            PsbtIn.TAP_BIP32_DERIVATION,
            Uint8Array.from([0x03]),
          ).toHexaString(),
          new Value(Uint8Array.of(0x23)),
        ],
        [
          new Key(
            PsbtIn.TAP_BIP32_DERIVATION,
            Uint8Array.from([0x04]),
          ).toHexaString(),
          new Value(Uint8Array.of(0x32)),
        ],
      ]),
    ]);
    // when
    const keyDatas = psbt.getInputKeyDatas(0, PsbtIn.TAP_BIP32_DERIVATION);
    // then
    expect(keyDatas).toStrictEqual(Just(["03", "04"]));
  });
  it("missing global key", () => {
    expect(
      TEST_PSBT.getGlobalValue(PsbtGlobal.TX_MODIFIABLE).isJust(),
    ).toStrictEqual(false);
  });

  it("missing input", () => {
    expect(
      TEST_PSBT.getInputValue(1, PsbtIn.NON_WITNESS_UTXO).isJust(),
    ).toStrictEqual(false);
  });

  it("missing input key", () => {
    expect(
      TEST_PSBT.getInputValue(0, PsbtIn.MUSIG2_PUB_NONCE).isJust(),
    ).toStrictEqual(false);
  });

  it("missing output", () => {
    expect(
      TEST_PSBT.getOutputValue(1, PsbtOut.WITNESS_SCRIPT).isJust(),
    ).toStrictEqual(false);
  });

  it("missing output key", () => {
    expect(
      TEST_PSBT.getOutputValue(0, PsbtOut.TAP_TREE).isJust(),
    ).toStrictEqual(false);
  });

  it("should set input value", () => {
    // given
    const psbt = new Psbt(new Map(), [new Map()]);
    const value = new Value(Uint8Array.of(0x03));
    // when
    psbt.setInputValue(0, PsbtIn.PARTIAL_SIG, value);
    // then
    expect(psbt).toStrictEqual(
      new Psbt(
        new Map(),
        [new Map([[new Key(PsbtIn.PARTIAL_SIG).toHexaString(), value]])],
        [],
      ),
    );
  });
  it("should set output value", () => {
    // given
    const psbt = new Psbt(new Map(), [], [new Map()]);
    const value = new Value(Uint8Array.of(0x42));
    // when
    psbt.setOutputValue(0, PsbtOut.AMOUNT, value);
    // then
    expect(psbt).toStrictEqual(
      new Psbt(
        new Map(),
        [],
        [new Map([[new Key(PsbtOut.AMOUNT).toHexaString(), value]])],
      ),
    );
  });
  it("should set global value", () => {
    // given
    const psbt = new Psbt();
    const value = new Value(Uint8Array.of(0x09));
    // when
    psbt.setGlobalValue(PsbtGlobal.VERSION, value);
    // then
    expect(psbt).toStrictEqual(
      new Psbt(new Map([[new Key(PsbtGlobal.VERSION).toHexaString(), value]])),
    );
  });
  it("should set input key data", () => {
    // given
    const psbt = new Psbt(new Map(), [new Map()]);
    const value = new Value(Uint8Array.of(0x03));
    // when
    psbt.setKeyDataInputValue(
      0,
      PsbtIn.PARTIAL_SIG,
      Uint8Array.from([0x42]),
      value,
    );
    // then
    expect(psbt).toStrictEqual(
      new Psbt(
        new Map(),
        [
          new Map([
            [
              new Key(
                PsbtIn.PARTIAL_SIG,
                Uint8Array.from([0x42]),
              ).toHexaString(),
              value,
            ],
          ]),
        ],
        [],
      ),
    );
  });
  it("should remove input entries", () => {
    // given
    const psbt = new Psbt(new Map(), [
      new Map([
        [
          new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
          new Value(Uint8Array.of(0x03)),
        ],
        [
          new Key(
            PsbtIn.PARTIAL_SIG,
            Uint8Array.from([0x01, 0x02]),
          ).toHexaString(),
          new Value(Uint8Array.of(0x07)),
        ],
        [
          new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
          new Value(Uint8Array.of(0x04)),
        ],
      ]),
    ]);
    // when
    psbt.deleteInputEntries(0, [PsbtIn.PARTIAL_SIG, PsbtIn.NON_WITNESS_UTXO]);
    // then
    expect(psbt).toStrictEqual(
      new Psbt(new Map(), [
        new Map([
          [
            new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
            new Value(Uint8Array.of(0x03)),
          ],
        ]),
      ]),
    );
  });
});
