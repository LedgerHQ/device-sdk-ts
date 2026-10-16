import { Just, Nothing } from "purify-ts";

import {
  ArrayType,
  type FieldType,
  PrimitiveType,
  StructType,
} from "@internal/typed-data/model/Types";

import {
  buildEip712V2Schema,
  type Eip712V2Types,
} from "./Eip712V2SchemaBuilder";
import { buildEip712V2Values } from "./Eip712V2ValuesBuilder";
import { encodeTlv, encodeTlvUInt } from "./tlv";

const string = () => new PrimitiveType("string", "string", Nothing);
const address = () => new PrimitiveType("address", "address", Nothing);

const domainOnly = (fields: Record<string, FieldType>): Eip712V2Types => ({
  EIP712Domain: { name: string() },
  Root: fields,
});

const buildValues = (types: Eip712V2Types, message: Record<string, unknown>) =>
  buildEip712V2Values({
    types,
    primaryType: "Root",
    derivationPath: "44'/60'/0'/0/0",
    domain: { name: "x" },
    message,
  });

/**
 * The encoders reject rather than emit something the device would have to
 * interpret, so these are the boundary of what a caller may hand them.
 */
describe("EIP-712 V2 rejections", () => {
  describe("tlv", () => {
    it("rejects a record too long for the transport's length prefix", () => {
      expect(() => encodeTlv(0x01, new Uint8Array(0x10000))).toThrow(
        /over the 65535 byte limit/,
      );
    });

    it("rejects a negative integer payload", () => {
      expect(() => encodeTlvUInt(0x04, -1)).toThrow(/non-negative integer/);
    });

    it("rejects a fractional integer payload", () => {
      expect(() => encodeTlvUInt(0x04, 1.5)).toThrow(/non-negative integer/);
    });
  });

  describe("schema", () => {
    it("rejects a sized type that carries no size", () => {
      const types = domainOnly({
        amount: new PrimitiveType("uint256", "uint", Nothing),
      });

      expect(
        buildEip712V2Schema(types)
          .mapLeft((e) => e.message)
          .extract(),
      ).toMatch(/missing its size/);
    });
  });

  describe("values", () => {
    it("rejects a struct whose value is not an object", () => {
      const types: Eip712V2Types = {
        ...domainOnly({ person: new StructType("Person") }),
        Person: { name: string() },
      };

      expect(
        buildValues(types, { person: "not an object" })
          .mapLeft((e) => e.message)
          .extract(),
      ).toMatch(/Expected an object for struct Person/);
    });

    it("names the field whose value is missing", () => {
      const types = domainOnly({ owner: address() });

      expect(
        buildValues(types, {})
          .mapLeft((e) => e.message)
          .extract(),
      ).toMatch(/Missing value for Root\.owner/);
    });

    it("rejects an array whose value is not an array", () => {
      const types = domainOnly({
        wallets: new ArrayType("address[]", address(), "address", Nothing, [
          Nothing,
        ]),
      });

      expect(
        buildValues(types, { wallets: "0x00" })
          .mapLeft((e) => e.message)
          .extract(),
      ).toMatch(/Expected an array for address\[\]/);
    });

    it("rejects a fixed array holding the wrong number of elements", () => {
      const types = domainOnly({
        pair: new ArrayType("address[2]", address(), "address", Just(2), [
          Just(2),
        ]),
      });

      expect(
        buildValues(types, { pair: ["0x01"] })
          .mapLeft((e) => e.message)
          .extract(),
      ).toMatch(/holds 1 elements where the schema declares 2/);
    });

    it("rejects a leaf the type cannot encode", () => {
      const types = domainOnly({ owner: address() });

      expect(
        buildValues(types, { owner: 42 })
          .mapLeft((e) => e.message)
          .extract(),
      ).toMatch(/not encodable as address/);
    });

    it("rejects a message whose primary type the schema never declares", () => {
      expect(
        buildValues({ EIP712Domain: { name: string() } }, {})
          .mapLeft((e) => e.message)
          .extract(),
      ).toMatch(/Unknown struct Root/);
    });
  });
});
