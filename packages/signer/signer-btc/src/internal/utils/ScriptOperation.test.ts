import { encodeScriptOperations } from "@internal/utils/ScriptOperation";

describe("ScriptOperation", () => {
  it("should return buffer containing data length", () => {
    // given
    const data = new Uint8Array(new Array(0x4d).fill(42));
    // when
    const ret = encodeScriptOperations(data);
    // then
    expect(ret).toStrictEqual(new Uint8Array([0x4d, ...data]));
  });
  it("should return buffer containing data length", () => {
    // given
    const data = new Uint8Array(new Array(0xfe).fill(42));
    // when
    const ret = encodeScriptOperations(data);
    // then
    expect(ret).toStrictEqual(new Uint8Array([0x4c, 0xfe, ...data]));
  });
  it("should return buffer containing data length", () => {
    // given
    const data = new Uint8Array(new Array(0x1000).fill(42));
    // when
    const ret = encodeScriptOperations(data);
    // then
    expect(ret).toStrictEqual(new Uint8Array([0x4d, 0x00, 0x10, ...data]));
  });
});
