import { type LoggerPublisherService } from "@api/types";

import { type RefresherController, RefresherService } from "./RefresherService";

let refresher: RefresherController;
describe("RefresherService", () => {
  let mockLogger: LoggerPublisherService & {
    debug: ReturnType<typeof vi.fn>;
  };
  const mockedLoggerModuleFactory = vi.fn(() => mockLogger);

  beforeEach(() => {
    refresher = {
      start: vi.fn(),
      stop: vi.fn(),
    };
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      subscribers: [],
    };
  });

  it("should be created", () => {
    const refresherService = new RefresherService(
      mockedLoggerModuleFactory,
      refresher,
    );
    expect(refresherService).toBeDefined();
  });

  describe("with only 1 blocker", () => {
    it("should disable the refresher", () => {
      const refresherService = new RefresherService(
        mockedLoggerModuleFactory,
        refresher,
      );
      refresherService.disableRefresher("test");
      expect(refresher.stop).toHaveBeenCalled();
    });

    it("should reenable the refresher", () => {
      const refresherService = new RefresherService(
        mockedLoggerModuleFactory,
        refresher,
      );
      const reenableRefresher = refresherService.disableRefresher("test");
      reenableRefresher();
      expect(refresher.stop).toHaveBeenCalled();
      expect(refresher.start).toHaveBeenCalled();
    });
  });

  describe("with 2+ blockers", () => {
    it("should not disable the refresher a second time", () => {
      const refresherService = new RefresherService(
        mockedLoggerModuleFactory,
        refresher,
      );
      refresherService.disableRefresher("test");
      refresherService.disableRefresher("test-2");
      expect(refresher.stop).toHaveBeenCalledTimes(1);
    });

    it("should reenable the refresher when the last blocker is removed", () => {
      const refresherService = new RefresherService(
        mockedLoggerModuleFactory,
        refresher,
      );
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
