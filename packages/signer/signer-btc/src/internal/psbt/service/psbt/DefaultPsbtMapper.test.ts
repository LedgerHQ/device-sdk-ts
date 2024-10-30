import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import * as bjs from "bitcoinjs-lib";
import { Left, Right } from "purify-ts";

import { Psbt } from "@internal/psbt/model/Psbt";

import { DefaultPsbtMapper } from "./DefaultPsbtMapper";
import { type DefaultPsbtSerializer } from "./DefaultPsbtSerializer";
import { type DefaultPsbtV2Normalizer } from "./DefaultPsbtV2Normalizer";

describe("DefaultPsbtMapper tests", () => {
  // Test case from https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#user-content-Test_Vectors
  const SERIALIZED_PSBT_V0_HEX =
    "70736274ff0100a00200000002ab0949a08c5af7c49b8212f417e2f15ab3f5c33dcf153821a8139f877a5b7be40000000000feffffffab0949a08c5af7c49b8212f417e2f15ab3f5c33dcf153821a8139f877a5b7be40100000000feffffff02603bea0b000000001976a914768a40bbd740cbe81d988e71de2a4d5c71396b1d88ac8e240000000000001976a9146f4620b553fa095e721b9ee0efe9fa039cca459788ac00000000000100df0200000001268171371edff285e937adeea4b37b78000c0566cbb3ad64641713ca42171bf6000000006a473044022070b2245123e6bf474d60c5b50c043d4c691a5d2435f09a34a7662a9dc251790a022001329ca9dacf280bdf30740ec0390422422c81cb45839457aeb76fc12edd95b3012102657d118d3357b8e0f4c2cd46db7b39f6d9c38d9a70abcb9b2de5dc8dbfe4ce31feffffff02d3dff505000000001976a914d0c59903c5bac2868760e90fd521a4665aa7652088ac00e1f5050000000017a9143545e6e33b832c47050f24d3eeb93c9c03948bc787b32e13000001012000e1f5050000000017a9143545e6e33b832c47050f24d3eeb93c9c03948bc787010416001485d13537f2e265405a34dbafa9e3dda01fb8230800220202ead596687ca806043edc3de116cdf29d5e9257c196cd055cf698c8d02bf24e9910b4a6ba670000008000000080020000800022020394f62be9df19952c5587768aeb7698061ad2c4a25c894f47d8c162b4d7213d0510b4a6ba6700000080010000800200008000";
  const SERIALIZED_PSBT_V0_BASE64 =
    "cHNidP8BAKACAAAAAqsJSaCMWvfEm4IS9Bfi8Vqz9cM9zxU4IagTn4d6W3vkAAAAAAD+////qwlJoIxa98SbghL0F+LxWrP1wz3PFTghqBOfh3pbe+QBAAAAAP7///8CYDvqCwAAAAAZdqkUdopAu9dAy+gdmI5x3ipNXHE5ax2IrI4kAAAAAAAAGXapFG9GILVT+glechue4O/p+gOcykWXiKwAAAAAAAEA3wIAAAABJoFxNx7f8oXpN63upLN7eAAMBWbLs61kZBcTykIXG/YAAAAAakcwRAIgcLIkUSPmv0dNYMW1DAQ9TGkaXSQ18Jo0p2YqncJReQoCIAEynKnazygL3zB0DsA5BCJCLIHLRYOUV663b8Eu3ZWzASECZX0RjTNXuOD0ws1G23s59tnDjZpwq8ubLeXcjb/kzjH+////AtPf9QUAAAAAGXapFNDFmQPFusKGh2DpD9UhpGZap2UgiKwA4fUFAAAAABepFDVF5uM7gyxHBQ8k0+65PJwDlIvHh7MuEwAAAQEgAOH1BQAAAAAXqRQ1RebjO4MsRwUPJNPuuTycA5SLx4cBBBYAFIXRNTfy4mVAWjTbr6nj3aAfuCMIACICAurVlmh8qAYEPtw94RbN8p1eklfBls0FXPaYyNAr8k6ZELSmumcAAACAAAAAgAIAAIAAIgIDlPYr6d8ZlSxVh3aK63aYBhrSxKJciU9H2MFitNchPQUQtKa6ZwAAAIABAACAAgAAgAA=";
  const SERIALIZED_PSBT_V0 = hexaStringToBuffer(SERIALIZED_PSBT_V0_HEX)!;

  // Mock PsbtSerializer
  const mockDeserialize = jest.fn();
  const mockSerializer: DefaultPsbtSerializer = {
    deserialize: mockDeserialize,
  } as unknown as DefaultPsbtSerializer;

  // Mock PsbtV2Normalizer
  const mockNormalize = jest.fn();
  const mockNormalizer: DefaultPsbtV2Normalizer = {
    normalize: mockNormalize,
  } as unknown as DefaultPsbtV2Normalizer;

  // Mocked psbt
  const createPsbt = () => new Psbt();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("Map hex string", () => {
    // Given
    const parsedPsbt = createPsbt();
    const normalizedPsbt = createPsbt();
    mockDeserialize.mockReturnValueOnce(Right(parsedPsbt));
    mockNormalize.mockReturnValueOnce(Right(normalizedPsbt));
    const mapper = new DefaultPsbtMapper(mockSerializer, mockNormalizer);

    // When
    const mapped = mapper.map(SERIALIZED_PSBT_V0_HEX);

    // Then
    expect(mockDeserialize).toHaveBeenCalledWith(SERIALIZED_PSBT_V0);
    expect(mockNormalize).toHaveBeenCalledWith(parsedPsbt);
    expect(mapped.isRight()).toStrictEqual(true);
    expect(mapped.unsafeCoerce()).toStrictEqual(normalizedPsbt);
  });

  it("Map base64 string", () => {
    // Given
    const parsedPsbt = createPsbt();
    const normalizedPsbt = createPsbt();
    mockDeserialize.mockReturnValueOnce(Right(parsedPsbt));
    mockNormalize.mockReturnValueOnce(Right(normalizedPsbt));
    const mapper = new DefaultPsbtMapper(mockSerializer, mockNormalizer);

    // When
    const mapped = mapper.map(SERIALIZED_PSBT_V0_BASE64);

    // Then
    expect(mockDeserialize).toHaveBeenCalledWith(SERIALIZED_PSBT_V0);
    expect(mockNormalize).toHaveBeenCalledWith(parsedPsbt);
    expect(mapped.isRight()).toStrictEqual(true);
    expect(mapped.unsafeCoerce()).toStrictEqual(normalizedPsbt);
  });

  it("Map bjs transaction", () => {
    // Given
    const parsedPsbt = createPsbt();
    const normalizedPsbt = createPsbt();
    mockDeserialize.mockReturnValueOnce(Right(parsedPsbt));
    mockNormalize.mockReturnValueOnce(Right(normalizedPsbt));
    const mapper = new DefaultPsbtMapper(mockSerializer, mockNormalizer);

    // When
    const mapped = mapper.map(bjs.Psbt.fromHex(SERIALIZED_PSBT_V0_HEX));

    // Then
    expect(mockDeserialize).toHaveBeenCalledWith(SERIALIZED_PSBT_V0);
    expect(mockNormalize).toHaveBeenCalledWith(parsedPsbt);
    expect(mapped.isRight()).toStrictEqual(true);
    expect(mapped.unsafeCoerce()).toStrictEqual(normalizedPsbt);
  });

  it("Map byte array", () => {
    // Given
    const parsedPsbt = createPsbt();
    const normalizedPsbt = createPsbt();
    mockDeserialize.mockReturnValueOnce(Right(parsedPsbt));
    mockNormalize.mockReturnValueOnce(Right(normalizedPsbt));
    const mapper = new DefaultPsbtMapper(mockSerializer, mockNormalizer);

    // When
    const mapped = mapper.map(SERIALIZED_PSBT_V0);

    // Then
    expect(mockDeserialize).toHaveBeenCalledWith(SERIALIZED_PSBT_V0);
    expect(mockNormalize).toHaveBeenCalledWith(parsedPsbt);
    expect(mapped.isRight()).toStrictEqual(true);
    expect(mapped.unsafeCoerce()).toStrictEqual(normalizedPsbt);
  });

  it("Map invalid string", () => {
    // Given
    const parsedPsbt = createPsbt();
    const normalizedPsbt = createPsbt();
    mockDeserialize.mockReturnValueOnce(Right(parsedPsbt));
    mockNormalize.mockReturnValueOnce(Right(normalizedPsbt));
    const mapper = new DefaultPsbtMapper(mockSerializer, mockNormalizer);

    // When
    const mapped = mapper.map("some random string");

    // Then
    expect(mapped.isRight()).toStrictEqual(false);
  });

  it("Parser failure", () => {
    // Given
    const normalizedPsbt = createPsbt();
    mockDeserialize.mockReturnValueOnce(Left(new Error()));
    mockNormalize.mockReturnValueOnce(Right(normalizedPsbt));
    const mapper = new DefaultPsbtMapper(mockSerializer, mockNormalizer);

    // When
    const mapped = mapper.map(SERIALIZED_PSBT_V0);

    // Then
    expect(mockDeserialize).toHaveBeenCalledWith(SERIALIZED_PSBT_V0);
    expect(mapped.isRight()).toStrictEqual(false);
  });

  it("Normalizer failure", () => {
    // Given
    const parsedPsbt = createPsbt();
    mockDeserialize.mockReturnValueOnce(Right(parsedPsbt));
    mockNormalize.mockReturnValueOnce(Left(new Error()));
    const mapper = new DefaultPsbtMapper(mockSerializer, mockNormalizer);

    // When
    const mapped = mapper.map(SERIALIZED_PSBT_V0);

    // Then
    expect(mockDeserialize).toHaveBeenCalledWith(SERIALIZED_PSBT_V0);
    expect(mockNormalize).toHaveBeenCalledWith(parsedPsbt);
    expect(mapped.isRight()).toStrictEqual(false);
  });
});
