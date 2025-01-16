import { CommandResultFactory } from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";

import { UpdatePsbtTask } from "@internal/app-binder/task/UpdatePsbtTask";
import { Key } from "@internal/psbt/model/Key";
import { Psbt, PsbtGlobal, PsbtIn } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { DefaultValueParser } from "@internal/psbt/service/value/DefaultValueParser";

describe("UpdatePsbtTask", () => {
  it("should update taproot psbt with signatures", async () => {
    // given
    const schnorr = Uint8Array.from(new Array(64).fill(0x64));
    const signature = {
      inputIndex: 0,
      signature: schnorr,
      pubkey: Uint8Array.from([0x21]),
    };

    const fakePsbt = new Psbt(
      new Map([
        [
          new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
          new Value(Uint8Array.of(1)),
        ],
      ]),
      [
        new Map([
          [
            new Key(
              PsbtIn.TAP_BIP32_DERIVATION,
              Uint8Array.from([0x01, 0x03, 0x04, 0x11]),
            ).toHexaString(),
            new Value(Uint8Array.from([0x10, 0x12])),
          ],
          [
            new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
            new Value(Uint8Array.from([])),
          ],
          [
            new Key(PsbtIn.REDEEM_SCRIPT).toHexaString(),
            new Value(Uint8Array.from([0x09, 0x99])),
          ],
        ]),
      ],
    );

    const psbtMapperMock = {
      map: jest.fn(() => Right(fakePsbt)),
    } as unknown as PsbtMapper;

    // when
    const result = await new UpdatePsbtTask(
      {
        psbt: "",
        signatures: [signature],
      },
      new DefaultValueParser(),
      psbtMapperMock,
    ).run();

    // then
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: new Psbt(
          new Map([
            [
              new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
              new Value(Uint8Array.from([1])),
            ],
          ]),
          [
            new Map([
              [
                new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
                new Value(Uint8Array.from([])),
              ],
              [
                new Key(PsbtIn.REDEEM_SCRIPT).toHexaString(),
                new Value(Uint8Array.from([0x09, 0x99])),
              ],
              [
                new Key(PsbtIn.FINAL_SCRIPTWITNESS).toHexaString(),
                new Value(Uint8Array.from([0x01, 0x40, ...schnorr])),
              ],
            ]),
          ],
        ),
      }),
    );
  });
  it("should update legacy psbt with signatures", async () => {
    // given
    const signature = {
      inputIndex: 0,
      signature: Uint8Array.from([0x42]),
      pubkey: Uint8Array.from([0x21]),
    };

    const fakePsbt = new Psbt(
      new Map([
        [
          new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
          new Value(Uint8Array.of(1)),
        ],
      ]),
      [
        new Map([
          [
            new Key(
              PsbtIn.BIP32_DERIVATION,
              Uint8Array.from([0x01, 0x02]),
            ).toHexaString(),
            new Value(Uint8Array.from([])),
          ],
          [
            new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
            new Value(Uint8Array.from([])),
          ],
          [
            new Key(PsbtIn.REDEEM_SCRIPT).toHexaString(),
            new Value(Uint8Array.from([0x09, 0x99])),
          ],
        ]),
      ],
    );

    const psbtMapperMock = {
      map: jest.fn(() => Right(fakePsbt)),
    } as unknown as PsbtMapper;

    // when
    const result = await new UpdatePsbtTask(
      {
        psbt: "",
        signatures: [signature],
      },
      new DefaultValueParser(),
      psbtMapperMock,
    ).run();

    // then
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: new Psbt(
          new Map([
            [
              new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
              new Value(Uint8Array.from([1])),
            ],
          ]),
          [
            new Map([
              [
                new Key(PsbtIn.NON_WITNESS_UTXO).toHexaString(),
                new Value(Uint8Array.from([])),
              ],
              [
                new Key(PsbtIn.REDEEM_SCRIPT).toHexaString(),
                new Value(Uint8Array.from([0x09, 0x99])),
              ],
              [
                new Key(PsbtIn.FINAL_SCRIPTSIG).toHexaString(),
                new Value(Uint8Array.from([0x01, 0x21, 0x01, 0x42])),
              ],
            ]),
          ],
        ),
      }),
    );
  });
  it("should update legacy segwit psbt with signatures", async () => {
    // given
    const signature = {
      inputIndex: 0,
      signature: Uint8Array.from([0x42]),
      pubkey: Uint8Array.from([0x21]),
    };

    const fakePsbt = new Psbt(
      new Map([
        [
          new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
          new Value(Uint8Array.of(1)),
        ],
      ]),
      [
        new Map([
          [
            new Key(
              PsbtIn.BIP32_DERIVATION,
              Uint8Array.from([0x01, 0x02]),
            ).toHexaString(),
            new Value(Uint8Array.from([])),
          ],
          [
            new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
            new Value(Uint8Array.from([])),
          ],
          [
            new Key(PsbtIn.REDEEM_SCRIPT).toHexaString(),
            new Value(Uint8Array.from([0x09, 0x99])),
          ],
        ]),
      ],
    );

    const psbtMapperMock = {
      map: jest.fn(() => Right(fakePsbt)),
    } as unknown as PsbtMapper;

    // when
    const result = await new UpdatePsbtTask(
      {
        psbt: "",
        signatures: [signature],
      },
      new DefaultValueParser(),
      psbtMapperMock,
    ).run();

    // then
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: new Psbt(
          new Map([
            [
              new Key(PsbtGlobal.INPUT_COUNT).toHexaString(),
              new Value(Uint8Array.from([1])),
            ],
          ]),
          [
            new Map([
              [
                new Key(PsbtIn.WITNESS_UTXO).toHexaString(),
                new Value(Uint8Array.from([])),
              ],
              [
                new Key(PsbtIn.REDEEM_SCRIPT).toHexaString(),
                new Value(Uint8Array.from([0x09, 0x99])),
              ],
              [
                new Key(PsbtIn.FINAL_SCRIPTWITNESS).toHexaString(),
                new Value(Uint8Array.from([0x02, 0x01, 0x21, 0x01, 0x42])),
              ],
              [
                new Key(PsbtIn.FINAL_SCRIPTSIG).toHexaString(),
                new Value(Uint8Array.from([0x02, 0x09, 0x99])),
              ],
            ]),
          ],
        ),
      }),
    );
  });
});
