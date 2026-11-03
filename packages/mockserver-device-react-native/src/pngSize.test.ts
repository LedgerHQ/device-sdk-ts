import { aPngDataUri } from "./__tests__/png";
import { pngSize } from "./pngSize";

describe("pngSize", () => {
  it("reads a PNG's size in pixels from its header", () => {
    expect(pngSize(aPngDataUri(400, 672))).toEqual({ width: 400, height: 672 });
  });

  it("reads it whatever type the data URI declares", () => {
    const png = aPngDataUri(128, 64).replace(
      "image/png",
      "application/octet-stream",
    );

    expect(pngSize(png)).toEqual({ width: 128, height: 64 });
  });

  it("has no size for anything else", () => {
    expect(pngSize("data:image/png;base64,cG5n")).toBeNull();
    expect(
      pngSize(
        "data:text/plain;base64,aGVsbG8gd29ybGQsIGhlbGxvIHdvcmxkLCBoZWxsbw==",
      ),
    ).toBeNull();
    expect(pngSize("https://example.com/screen.png")).toBeNull();
  });
});
