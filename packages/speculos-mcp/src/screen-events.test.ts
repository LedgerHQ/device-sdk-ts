import { describe, expect, it } from "vitest";

import type { ScreenEvent } from "./screen-events";
import {
  eventsEqual,
  findConfirmRejectButton,
  findRejectButton,
  findSignButton,
  formatEvents,
} from "./screen-events";

function event(text: string, x = 0, y = 0, w = 100, h = 32): ScreenEvent {
  return { text, x, y, w, h };
}

describe("screen-events", () => {
  describe("formatEvents", () => {
    it("returns (empty screen) for empty array", () => {
      expect(formatEvents([])).toBe("(empty screen)");
    });

    it("joins event texts with newlines", () => {
      const events = [event("Review transaction"), event("Hold to sign")];
      expect(formatEvents(events)).toBe("Review transaction\nHold to sign");
    });
  });

  describe("eventsEqual", () => {
    it("returns true for two empty arrays", () => {
      expect(eventsEqual([], [])).toBe(true);
    });

    it("returns true for identical event texts", () => {
      const a = [event("Review"), event("Hold to sign")];
      const b = [event("Review", 10, 20), event("Hold to sign", 30, 40)];
      expect(eventsEqual(a, b)).toBe(true);
    });

    it("returns false for different lengths", () => {
      const a = [event("Review")];
      const b = [event("Review"), event("Hold to sign")];
      expect(eventsEqual(a, b)).toBe(false);
    });

    it("returns false for different text content", () => {
      const a = [event("Review"), event("Hold to sign")];
      const b = [event("Review"), event("Reject")];
      expect(eventsEqual(a, b)).toBe(false);
    });

    it("returns false when first is empty and second is not", () => {
      expect(eventsEqual([], [event("Hello")])).toBe(false);
    });
  });

  describe("findRejectButton", () => {
    it("finds Reject button", () => {
      const events = [event("Hold to sign"), event("Reject")];
      expect(findRejectButton(events)?.text).toBe("Reject");
    });

    it("finds Back to safety button", () => {
      const events = [
        event("Accept risk and continue"),
        event("Back to safety"),
      ];
      expect(findRejectButton(events)?.text).toBe("Back to safety");
    });

    it("finds Refuse button", () => {
      const events = [event("Refuse")];
      expect(findRejectButton(events)?.text).toBe("Refuse");
    });

    it("finds Decline button", () => {
      const events = [event("Decline")];
      expect(findRejectButton(events)?.text).toBe("Decline");
    });

    it("returns undefined when no reject button", () => {
      const events = [event("Hold to sign"), event("Yes, reject")];
      expect(findRejectButton(events)).toBeUndefined();
    });
  });

  describe("findConfirmRejectButton", () => {
    it("finds Yes, reject button", () => {
      const events = [event("Reject transaction?"), event("Yes, reject")];
      expect(findConfirmRejectButton(events)?.text).toBe("Yes, reject");
    });

    it("finds Yes button", () => {
      const events = [event("Yes")];
      expect(findConfirmRejectButton(events)?.text).toBe("Yes");
    });

    it("finds Confirm button", () => {
      const events = [event("Confirm")];
      expect(findConfirmRejectButton(events)?.text).toBe("Confirm");
    });

    it("returns undefined when no confirm button", () => {
      const events = [event("Hold to sign"), event("Go back to transaction")];
      expect(findConfirmRejectButton(events)).toBeUndefined();
    });
  });

  describe("findSignButton", () => {
    it("finds Hold to sign button", () => {
      const events = [event("Review transaction"), event("Hold to sign")];
      expect(findSignButton(events)?.text).toBe("Hold to sign");
    });

    it("finds Sign button when Hold to sign not present", () => {
      const events = [event("Sign")];
      expect(findSignButton(events)?.text).toBe("Sign");
    });

    it("returns undefined when no sign button", () => {
      const events = [event("Reject"), event("Yes, reject")];
      expect(findSignButton(events)).toBeUndefined();
    });
  });
});
