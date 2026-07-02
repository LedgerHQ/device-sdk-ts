import { deriveSecureChannelResponse } from "./secureChannelApdus";

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
