/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { AxiosInstance } from "axios";

import type { ButtonKey } from "@internal/core/types";

import { AxiosButtonController } from "./AxiosButtonController";

describe("AxiosButtonController", () => {
  let postMock: ReturnType<typeof vi.fn>;
  let axiosFake: AxiosInstance;
  let controller: AxiosButtonController;

  beforeEach(() => {
    postMock = vi.fn().mockResolvedValue({ status: 200, data: {} });
    axiosFake = { post: postMock } as unknown as AxiosInstance;
    controller = new AxiosButtonController(axiosFake);
  });

  const keys: ButtonKey[] = ["left", "right", "both"];

  it.each<ButtonKey>(keys)(
    "press(%s) posts expected payload",
    async (key: ButtonKey) => {
      await controller.press(key);

      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith(`/button/${key}`, {
        action: "press-and-release",
      });
    },
  );

  it("propagates HTTP errors", async () => {
    const error = new Error("oups");
    postMock.mockRejectedValueOnce(error);

    await expect(controller.press("left" as ButtonKey)).rejects.toBe(error);
  });
});
