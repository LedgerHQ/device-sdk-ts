import { pressButtons, pressSequence } from "./buttonUseCases";

type ButtonKey = "left" | "right" | "both";
type ButtonController = { press: (k: ButtonKey) => Promise<void> };

const tick = () => Promise.resolve();

describe("buttonUsecases", () => {
  let controller: ButtonController & { press: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    controller = {
      press: vi.fn(() => Promise.resolve()),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("pressButtons", () => {
    it("returns functions that call controller.press with the correct keys", async () => {
      const api = pressButtons(controller);

      await api.left();
      await api.right();
      await api.both();

      expect(controller.press).toHaveBeenCalledTimes(3);
      expect(controller.press).toHaveBeenNthCalledWith(1, "left");
      expect(controller.press).toHaveBeenNthCalledWith(2, "right");
      expect(controller.press).toHaveBeenNthCalledWith(3, "both");
    });
  });

  describe("pressSequence", () => {
    it("presses keys in order and waits the default 200ms after each key (including last)", async () => {
      vi.useFakeTimers();
      const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const keys: ButtonKey[] = ["left", "right", "both"];

      const promise = pressSequence(controller, keys); // delay = 200

      // first press happens immediately (sync call of controller.press)
      expect(controller.press).toHaveBeenCalledTimes(1);
      expect(controller.press).toHaveBeenNthCalledWith(1, "left");

      // timeout is scheduled after the awaited press resolves
      await tick();
      expect(timeoutSpy).toHaveBeenCalledTimes(1);
      expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 200);

      // first delay elapse -> second press
      await vi.advanceTimersByTimeAsync(200);
      await tick();
      expect(controller.press).toHaveBeenCalledTimes(2);
      expect(controller.press).toHaveBeenNthCalledWith(2, "right");

      // next delay -> third press
      await vi.advanceTimersByTimeAsync(200);
      await tick();
      expect(controller.press).toHaveBeenCalledTimes(3);
      expect(controller.press).toHaveBeenNthCalledWith(3, "both");

      // final post-press delay
      await vi.advanceTimersByTimeAsync(200);
      await expect(promise).resolves.toBeUndefined();
    });

    it("uses the provided custom delay", async () => {
      vi.useFakeTimers();
      const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const keys: ButtonKey[] = ["left", "right"];

      const promise = pressSequence(controller, keys, 75);

      await tick();
      expect(timeoutSpy).toHaveBeenCalledTimes(1);
      expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 75);

      await vi.advanceTimersByTimeAsync(75);
      await tick();
      expect(timeoutSpy).toHaveBeenCalledTimes(2);
      expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 75);

      await vi.advanceTimersByTimeAsync(75);
      await expect(promise).resolves.toBeUndefined();
    });

    it("rejects if a press fails and stops processing subsequent keys", async () => {
      vi.useFakeTimers();

      const err = new Error("oups");
      controller.press
        .mockResolvedValueOnce(undefined) // first ok
        .mockRejectedValueOnce(err); // second fails

      const keys: ButtonKey[] = ["left", "right", "both"];

      const p = pressSequence(controller, keys, 50);

      const assertion = expect(p).rejects.toThrow("oups");

      await Promise.resolve(); // let first setTimeout schedule
      await vi.advanceTimersByTimeAsync(50);
      await Promise.resolve();

      await assertion;

      expect(controller.press).toHaveBeenCalledTimes(2);
      expect(controller.press).toHaveBeenNthCalledWith(1, "left");
      expect(controller.press).toHaveBeenNthCalledWith(2, "right");
    });
  });
});
