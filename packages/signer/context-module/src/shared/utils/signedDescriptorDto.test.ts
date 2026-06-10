import { Right } from "purify-ts";

import { signedDescriptorDtoCodec } from "./signedDescriptorDto";

describe("signedDescriptorDtoCodec", () => {
  const valid = {
    signedDescriptor: "deadbeef",
    keyId: "some_key",
    keyUsage: "coin_meta",
  };

  it("decodes a well-formed envelope as Right", () => {
    expect(signedDescriptorDtoCodec.decode(valid)).toEqual(Right(valid));
  });

  it("ignores extra fields (datasource-specific context)", () => {
    const withExtras = { ...valid, account_address: "abc", entry_index: 3 };
    expect(signedDescriptorDtoCodec.decode(withExtras)).toEqual(Right(valid));
  });

  it("rejects null and primitives", () => {
    expect(signedDescriptorDtoCodec.decode(null).isLeft()).toBe(true);
    expect(signedDescriptorDtoCodec.decode(undefined).isLeft()).toBe(true);
    expect(signedDescriptorDtoCodec.decode("string").isLeft()).toBe(true);
    expect(signedDescriptorDtoCodec.decode(42).isLeft()).toBe(true);
  });

  it.each([
    ["missing signedDescriptor", { keyId: "k", keyUsage: "u" }],
    ["empty signedDescriptor", { ...valid, signedDescriptor: "" }],
    ["non-string signedDescriptor", { ...valid, signedDescriptor: 123 }],
    ["missing keyId", { signedDescriptor: "ab", keyUsage: "u" }],
    ["non-string keyId", { ...valid, keyId: null }],
    ["missing keyUsage", { signedDescriptor: "ab", keyId: "k" }],
    ["non-string keyUsage", { ...valid, keyUsage: 0 }],
  ])("rejects %s", (_label, bad) => {
    expect(signedDescriptorDtoCodec.decode(bad).isLeft()).toBe(true);
  });
});
