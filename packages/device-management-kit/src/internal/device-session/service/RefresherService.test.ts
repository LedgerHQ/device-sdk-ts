import { type DeviceSessionRefresher } from "@internal/device-session/model/DeviceSessionRefresher";

import { RefresherService } from "./RefresherService";

let refresher: DeviceSessionRefresher;
describe("RefresherService", () => {
  beforeEach(() => {
    refresher = {
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as DeviceSessionRefresher;
  });

  it("should be created", () => {
    const refresherService = new RefresherService(refresher);
    expect(refresherService).toBeDefined();
  });

  describe("with only 1 blocker", () => {
    it("should disable the refresher", () => {
      const refresherService = new RefresherService(refresher);
      refresherService.disableRefresher("test");
      expect(refresher.stop).toHaveBeenCalled();
    });

    it("should reenable the refresher", () => {
      const refresherService = new RefresherService(refresher);
      const reenableRefresher = refresherService.disableRefresher("test");
      reenableRefresher();
      expect(refresher.stop).toHaveBeenCalled();
      expect(refresher.start).toHaveBeenCalled();
    });
  });

  describe("with 2+ blockers", () => {
    it("should not disable the refresher a second time", () => {
      const refresherService = new RefresherService(refresher);
      refresherService.disableRefresher("test");
      refresherService.disableRefresher("test-2");
      expect(refresher.stop).toHaveBeenCalledTimes(1);
    });

    it("should reenable the refresher when the last blocker is removed", () => {
      const refresherService = new RefresherService(refresher);
      const reenableRefresher1 = refresherService.disableRefresher("test");
      const reenableRefresher2 = refresherService.disableRefresher("test-2");
      expect(refresher.stop).toHaveBeenCalledTimes(1);
      reenableRefresher1();
      expect(refresher.start).not.toHaveBeenCalled();
      reenableRefresher2();
      expect(refresher.start).toHaveBeenCalled();
    });
  });
});
