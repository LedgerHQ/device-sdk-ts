import {
  buildSecureChannelPermissionApdu,
  createSecureChannelFlowId,
  deriveSecureChannelResponse,
  parseSecureChannelFlowId,
} from "./secureChannelApdus";

describe("secure-channel flow id", () => {
  it("is read back from the permission APDU it is built into", () => {
    const flowId = createSecureChannelFlowId();
    const apdu = buildSecureChannelPermissionApdu(flowId);

    expect(apdu).toBe(`e051000008${flowId}`);
    expect(parseSecureChannelFlowId(apdu)).toBe(flowId);
  });

  it("is not found in a permission APDU without one", () => {
    expect(parseSecureChannelFlowId("e051000000")).toBeUndefined();
    expect(parseSecureChannelFlowId("e051000008aabb")).toBeUndefined();
  });

  it("is not found in another APDU", () => {
    expect(
      parseSecureChannelFlowId("e052000008aabbccddeeff0011"),
    ).toBeUndefined();
  });
});

describe("deriveSecureChannelResponse", () => {
  it("returns a bare success for the permission APDU (0xE0 0x51)", () => {
    expect(deriveSecureChannelResponse("e051000000")).toBe("9000");
  });

  it("returns a parseable certificate for GetCertificate (0xE0 0x52)", () => {
    // LV("") + LV("aabbccdd") + 9000 so extractPublicKey yields a key.
    expect(deriveSecureChannelResponse("e052000000")).toBe("0004aabbccdd9000");
  });

  it("returns a bare success for any install-block APDU (0xE0 0xF0)", () => {
    // All install blocks derive to success regardless of their P1 byte, so an
    // unmocked install stream completes.
    expect(deriveSecureChannelResponse("e0f0000004aabbccdd")).toBe("9000");
    expect(deriveSecureChannelResponse("e0f0040004f00dface")).toBe("9000");
  });

  it("returns a genuine verdict (0000) for the genuine APDU (0xE0 0xF1)", () => {
    expect(deriveSecureChannelResponse("e0f1000000")).toBe("00009000");
  });

  it("returns undefined for a non-secure-channel APDU", () => {
    expect(deriveSecureChannelResponse("e0010000")).toBeUndefined();
  });
});
