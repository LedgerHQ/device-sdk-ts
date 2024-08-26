import {
  Command,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";
import { Just, Nothing } from "purify-ts";

import {
  ArrayType,
  PrimitiveType,
  StructType,
} from "@internal/typed-data/model/Types";

import {
  SendEIP712StructDefinitionCommand,
  SendEIP712StructDefinitionCommandArgs,
  StructDefinitionCommand,
} from "./SendEIP712StructDefinitionCommand";

const EIP712_DEF_NAME_EIP712DOMAIN = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0x00, 0x0c, 0x45, 0x49, 0x50, 0x37, 0x31, 0x32, 0x44, 0x6f,
  0x6d, 0x61, 0x69, 0x6e,
]);

const EIP712_DEF_NAME_GROUP = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0x00, 0x05, 0x47, 0x72, 0x6f, 0x75, 0x70,
]);

// name string
const EIP712_DEF_FIELD_NAME_STRING = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x06, 0x05, 0x04, 0x6e, 0x61, 0x6d, 0x65,
]);

// version string
const EIP712_DEF_FIELD_VERSION_STRING = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x09, 0x05, 0x07, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f,
  0x6e,
]);

// chainId uint256
const EIP712_DEF_FIELD_CHAINID_UINT256 = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x0a, 0x42, 0x20, 0x07, 0x63, 0x68, 0x61, 0x69, 0x6e,
  0x49, 0x64,
]);

// verifyingContract address
const EIP712_DEF_FIELD_VERIFYINGCONTRACT_ADDRESS = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x13, 0x03, 0x11, 0x76, 0x65, 0x72, 0x69, 0x66, 0x79,
  0x69, 0x6e, 0x67, 0x43, 0x6f, 0x6e, 0x74, 0x72, 0x61, 0x63, 0x74,
]);

// members Person[]
const EIP712_DEF_FIELD_MEMBERS_PERSON = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x12, 0x80, 0x06, 0x50, 0x65, 0x72, 0x73, 0x6f, 0x6e,
  0x01, 0x00, 0x07, 0x6d, 0x65, 0x6d, 0x62, 0x65, 0x72, 0x73,
]);

// from Person
const EIP712_DEF_FIELD_FROM_PERSON = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x0d, 0x00, 0x06, 0x50, 0x65, 0x72, 0x73, 0x6f, 0x6e,
  0x04, 0x66, 0x72, 0x6f, 0x6d,
]);

// wallets address[]
const EIP712_DEF_FIELD_WALLETS_ADDRESS = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x0b, 0x83, 0x01, 0x00, 0x07, 0x77, 0x61, 0x6c, 0x6c,
  0x65, 0x74, 0x73,
]);

// staticExtradata bytes
const EIP712_DEF_FIELD_STATICEXTRADATA_BYTES = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x11, 0x07, 0x0f, 0x73, 0x74, 0x61, 0x74, 0x69, 0x63,
  0x45, 0x78, 0x74, 0x72, 0x61, 0x64, 0x61, 0x74, 0x61,
]);

// replacementPattern bytes
const EIP712_DEF_FIELD_REPLACEMENTPATTERN_BYTES = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x14, 0x07, 0x12, 0x72, 0x65, 0x70, 0x6c, 0x61, 0x63,
  0x65, 0x6d, 0x65, 0x6e, 0x74, 0x50, 0x61, 0x74, 0x74, 0x65, 0x72, 0x6e,
]);

// dataType bytes4
const EIP712_DEF_FIELD_DATA_TYPE_BYTES4 = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x0b, 0x46, 0x04, 0x08, 0x64, 0x61, 0x74, 0x61, 0x54,
  0x79, 0x70, 0x65,
]);

// document string[3][]
const EIP712_DEF_FIELD_DOCUMENT_STRING = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x0e, 0x85, 0x02, 0x01, 0x03, 0x00, 0x08, 0x64, 0x6f,
  0x63, 0x75, 0x6d, 0x65, 0x6e, 0x74,
]);

// depthy uint8[][][][]
const EIP712_DEF_FIELD_DEPTHY_UINT8 = Uint8Array.from([
  0xe0, 0x1a, 0x00, 0xff, 0x0e, 0xc2, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x06,
  0x64, 0x65, 0x70, 0x74, 0x68, 0x79,
]);

// TODO: find examples for bool and int types.

describe("SendEIP712StructDefinitionCommand", () => {
  let command: Command<void, SendEIP712StructDefinitionCommandArgs>;

  describe("getApdu", () => {
    it("should return the apdu for 'EIP712Domain' name definition", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Name,
        name: "EIP712Domain",
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_NAME_EIP712DOMAIN);
    });

    it("should return the apdu for 'Group' name definition", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Name,
        name: "Group",
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_NAME_GROUP);
    });

    it("should return the apdu for 'name' of type 'string'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "name",
        type: new PrimitiveType("string", "string", Nothing),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_NAME_STRING);
    });

    it("should return the apdu for 'version' of type 'string'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "version",
        type: new PrimitiveType("string", "string", Nothing),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_VERSION_STRING);
    });

    it("should return the apdu for 'chainId' of type 'uint256'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "chainId",
        type: new PrimitiveType("uint256", "uint", Just(32)),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_CHAINID_UINT256);
    });

    it("should return the apdu for 'verifyingContract' of type 'address'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "verifyingContract",
        type: new PrimitiveType("address", "address", Nothing),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        EIP712_DEF_FIELD_VERIFYINGCONTRACT_ADDRESS,
      );
    });

    it("should return the apdu for 'members' of type 'Person[]'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "members",
        type: new ArrayType(
          "Person[]",
          new StructType("Person"),
          "Person",
          Nothing,
          [Nothing],
        ),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_MEMBERS_PERSON);
    });

    it("should return the apdu for 'from' of type 'Person'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "from",
        type: new StructType("Person"),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_FROM_PERSON);
    });

    it("should return the apdu for 'wallets' of type 'address[]'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "wallets",
        type: new ArrayType(
          "address[]",
          new PrimitiveType("address", "address", Nothing),
          "address",
          Nothing,
          [Nothing],
        ),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_WALLETS_ADDRESS);
    });

    it("should return the apdu for 'staticExtradata' of type 'bytes'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "staticExtradata",
        type: new PrimitiveType("bytes", "bytes", Nothing),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        EIP712_DEF_FIELD_STATICEXTRADATA_BYTES,
      );
    });

    it("should return the apdu for 'replacementPattern' of type 'bytes'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "replacementPattern",
        type: new PrimitiveType("bytes", "bytes", Nothing),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        EIP712_DEF_FIELD_REPLACEMENTPATTERN_BYTES,
      );
    });

    it("should return the apdu for 'dataType' of type 'bytes4'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "dataType",
        type: new PrimitiveType("bytes4", "bytes", Just(4)),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        EIP712_DEF_FIELD_DATA_TYPE_BYTES4,
      );
    });

    it("should return the apdu for 'document' of type 'string[3][]'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "document",
        type: new ArrayType(
          "string[3][]",
          new PrimitiveType("string", "string", Nothing),
          "string[3]",
          Nothing,
          [Just(3), Nothing],
        ),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_DOCUMENT_STRING);
    });

    it("should return the apdu for 'depthy' of type 'uint8[][][][]'", () => {
      // GIVEN
      command = new SendEIP712StructDefinitionCommand({
        command: StructDefinitionCommand.Field,
        name: "depthy",
        type: new ArrayType(
          "uint8[][][][]",
          new PrimitiveType("uint8", "uint", Just(1)),
          "uint8[][][]",
          Nothing,
          [Nothing, Nothing, Nothing, Nothing],
        ),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(EIP712_DEF_FIELD_DEPTHY_UINT8);
    });
  });

  describe("parseResponse", () => {
    it("should parse the response", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      // WHEN
      const parsedResponse = command.parseResponse(response);

      // THEN
      expect(parsedResponse).toStrictEqual(
        CommandResultFactory({ data: undefined }),
      );
    });

    it("should throw an error if the response is not successful", () => {
      // GIVEN
      const response = {
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: new Uint8Array(),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
