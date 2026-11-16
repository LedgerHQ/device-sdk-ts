import { AppState } from "./__mocks__/react-native";
import { nativeScreenPlatform } from "./nativeScreenPlatform";

describe("nativeScreenPlatform", () => {
  it("turns a screenshot into a data URI", async () => {
    const screenshot = new Blob(["png"], { type: "image/png" });

    await expect(nativeScreenPlatform.toImageSource(screenshot)).resolves.toBe(
      "data:image/png;base64,cG5n",
    );
  });

  it("is hidden only while the app is in the background", () => {
    const hiddenIn = (state: string) => {
      AppState.currentState = state;
      return nativeScreenPlatform.isHidden();
    };

    expect(hiddenIn("active")).toBe(false);
    expect(hiddenIn("inactive")).toBe(false);
    expect(hiddenIn("background")).toBe(true);
  });
});
