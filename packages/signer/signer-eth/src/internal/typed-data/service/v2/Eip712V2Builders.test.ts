import { bufferToHexaString } from "@ledgerhq/device-management-kit";

import { type TypedData } from "@api/model/TypedData";
import { DefaultTypedDataParserService } from "@internal/typed-data/service/DefaultTypedDataParserService";

import vectorFile from "./__fixtures__/eip712-v2-vectors.json";
import { buildEip712V2Schema } from "./Eip712V2SchemaBuilder";
import { buildEip712V2Values } from "./Eip712V2ValuesBuilder";

/**
 * Golden vectors produced by the Ethereum app's own ragger test client over its
 * tests/functional/eip712_input_files corpus. The app's functional suite checks that
 * client against the reference EIP-712 digest, so matching it byte-for-byte is what
 * makes these payloads correct rather than merely well-formed.
 *
 */
type Vector = {
  name: string;
  data: TypedData;
  schema: string;
  values: string;
};

const { derivationPath, vectors } = vectorFile as unknown as {
  derivationPath: string;
  vectors: Vector[];
};

describe("EIP-712 V2 builders", () => {
  it("covers the app's whole typed-data corpus", () => {
    expect(vectors.length).toBeGreaterThanOrEqual(24);
  });

  describe.each(vectors)("$name", ({ data, schema, values }) => {
    // The parser resolves the declared types and appends EIP712Domain when the message
    // omits it, which is the struct map both payloads are built from.
    const parsed = new DefaultTypedDataParserService().parse(data);

    it("parses", () => {
      expect(parsed.isRight()).toBe(true);
    });

    it("encodes EIP712_SCHEMA exactly as the app's client does", () => {
      const types = parsed.unsafeCoerce().types;
      const built = buildEip712V2Schema(types);
      expect(built.isRight()).toBe(true);
      expect(bufferToHexaString(built.unsafeCoerce(), false)).toBe(schema);
    });

    it("encodes EIP712_VALUES exactly as the app's client does", () => {
      const types = parsed.unsafeCoerce().types;
      const built = buildEip712V2Values({
        types,
        primaryType: data.primaryType,
        derivationPath,
        domain: data.domain as Record<string, unknown>,
        message: data.message,
      });
      expect(built.isRight()).toBe(true);
      expect(bufferToHexaString(built.unsafeCoerce(), false)).toBe(values);
    });
  });
});
