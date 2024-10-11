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
});
